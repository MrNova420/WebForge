/**
 * Stability tests for the physics system - real user workflow scenarios
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Vector3 } from '../src/math/Vector3';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { RigidBody, RigidBodyType } from '../src/physics/RigidBody';
import { SphereShape, BoxShape } from '../src/physics/CollisionShape';
import { SweepAndPruneBroadphase } from '../src/physics/BroadphaseCollision';
import { Narrowphase } from '../src/physics/NarrowphaseCollision';
import { ConstraintSolver } from '../src/physics/ConstraintSolver';
import { SoftBody } from '../src/physics/SoftBody';
import { VehiclePhysics } from '../src/physics/VehiclePhysics';

describe('Physics Stability Tests', () => {
    let world: PhysicsWorld;

    beforeEach(() => {
        world = new PhysicsWorld({ gravity: new Vector3(0, -9.81, 0) });
    });

    describe('Scenario 1: Gravity pulls a sphere down', () => {
        it('should move a dynamic body downward due to gravity after stepping', () => {
            const body = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 1.0,
                shape: new SphereShape(0.5),
            });
            body.setPosition(new Vector3(0, 10, 0));
            world.addBody(body);

            // Step enough time for at least one fixed step (default 1/60)
            world.step(1 / 60);

            const pos = body.getPosition();
            expect(pos.y).toBeLessThan(10);
        });
    });

    describe('Scenario 2: Overlapping bodies produce collision manifolds', () => {
        it('should detect collision when two sphere bodies overlap', () => {
            const bodyA = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 1.0,
                shape: new SphereShape(1.0),
            });
            bodyA.setPosition(new Vector3(0, 0, 0));

            const bodyB = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 1.0,
                shape: new SphereShape(1.0),
            });
            // Overlapping: distance 1.0, combined radii 2.0
            bodyB.setPosition(new Vector3(1.0, 0, 0));

            world.addBody(bodyA);
            world.addBody(bodyB);

            world.step(1 / 60);

            const manifolds = world.getManifolds();
            expect(manifolds.length).toBeGreaterThan(0);
        });
    });

    describe('Scenario 3: applyForce changes velocity after integrate', () => {
        it('should increase velocity when force is applied and body is integrated', () => {
            const body = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 1.0,
                linearDamping: 0,
            });
            body.setPosition(new Vector3(0, 0, 0));

            const initialVel = body.getVelocity();
            expect(initialVel.x).toBe(0);

            // Apply force in X direction
            body.applyForce(new Vector3(100, 0, 0));
            body.integrate(1 / 60);

            const vel = body.getVelocity();
            expect(vel.x).toBeGreaterThan(0);
        });
    });

    describe('Scenario 4: applyImpulse immediately changes velocity', () => {
        it('should change velocity immediately without integrate', () => {
            const body = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 2.0,
            });

            const velBefore = body.getVelocity();
            expect(velBefore.x).toBe(0);

            // Impulse of (10, 0, 0) on mass 2 => velocity change = 10 * (1/2) = 5
            body.applyImpulse(new Vector3(10, 0, 0));

            const velAfter = body.getVelocity();
            expect(velAfter.x).toBeCloseTo(5, 5);
        });
    });

    describe('Scenario 5: Static bodies do not move', () => {
        it('should not move a static body when force is applied', () => {
            const body = new RigidBody({
                type: RigidBodyType.STATIC,
                mass: 1.0,
                shape: new SphereShape(1.0),
            });
            body.setPosition(new Vector3(0, 5, 0));
            world.addBody(body);

            body.applyForce(new Vector3(1000, 1000, 1000));
            world.step(1 / 60);

            const pos = body.getPosition();
            expect(pos.x).toBe(0);
            expect(pos.y).toBe(5);
            expect(pos.z).toBe(0);

            const vel = body.getVelocity();
            expect(vel.x).toBe(0);
            expect(vel.y).toBe(0);
            expect(vel.z).toBe(0);
        });
    });

    describe('Scenario 6: Kinematic bodies do not respond to forces', () => {
        it('should not change kinematic body velocity from applied forces', () => {
            const body = new RigidBody({
                type: RigidBodyType.KINEMATIC,
                mass: 1.0,
            });
            body.setPosition(new Vector3(0, 0, 0));

            body.applyForce(new Vector3(500, 0, 0));
            body.applyImpulse(new Vector3(500, 0, 0));
            body.integrate(1 / 60);

            const vel = body.getVelocity();
            expect(vel.x).toBe(0);
            expect(vel.y).toBe(0);
            expect(vel.z).toBe(0);
        });
    });

    describe('Scenario 7: Raycast hits a sphere body', () => {
        it('should return a hit when ray intersects a sphere', () => {
            const body = new RigidBody({
                type: RigidBodyType.STATIC,
                mass: 0,
                shape: new SphereShape(1.0),
            });
            body.setPosition(new Vector3(0, 0, -5));
            world.addBody(body);

            const origin = new Vector3(0, 0, 0);
            const direction = new Vector3(0, 0, -1);
            const result = world.raycast(origin, direction, 100);

            expect(result).not.toBeNull();
            expect(result!.distance).toBeGreaterThan(0);
            expect(result!.distance).toBeLessThan(100);
            expect(result!.body).toBe(body);
        });
    });

    describe('Scenario 8: raycastAll returns multiple hits sorted by distance', () => {
        it('should return hits sorted by distance', () => {
            const bodyNear = new RigidBody({
                type: RigidBodyType.STATIC,
                mass: 0,
                shape: new SphereShape(0.5),
            });
            bodyNear.setPosition(new Vector3(0, 0, -3));

            const bodyFar = new RigidBody({
                type: RigidBodyType.STATIC,
                mass: 0,
                shape: new SphereShape(0.5),
            });
            bodyFar.setPosition(new Vector3(0, 0, -10));

            world.addBody(bodyNear);
            world.addBody(bodyFar);

            const origin = new Vector3(0, 0, 0);
            const direction = new Vector3(0, 0, -1);
            const results = world.raycastAll(origin, direction, 100);

            expect(results.length).toBe(2);
            expect(results[0].distance).toBeLessThan(results[1].distance);
            expect(results[0].body).toBe(bodyNear);
            expect(results[1].body).toBe(bodyFar);
        });
    });

    describe('Scenario 9: SoftBody cloth creation and simulation', () => {
        it('should create a cloth and step simulation without crashing', () => {
            const cloth = SoftBody.createCloth(2, 2, 4, 4);

            expect(cloth.getParticleCount()).toBeGreaterThan(0);
            expect(cloth.distanceConstraints.length).toBeGreaterThan(0);

            // Step several times without crashing
            for (let i = 0; i < 10; i++) {
                cloth.update(1 / 60);
            }

            const positions = cloth.getPositions();
            expect(positions.length).toBe(cloth.getParticleCount() * 3);
            // Verify no NaN values
            for (let i = 0; i < positions.length; i++) {
                expect(Number.isFinite(positions[i])).toBe(true);
            }
        });
    });

    describe('Scenario 10: VehiclePhysics creation with preset', () => {
        it('should create sedan, truck, and sports car without crashing', () => {
            const sedanConfig = VehiclePhysics.createSedan();
            const sedan = new VehiclePhysics(sedanConfig);
            expect(sedan.wheels.length).toBe(4);

            const truckConfig = VehiclePhysics.createTruck();
            const truck = new VehiclePhysics(truckConfig);
            expect(truck.wheels.length).toBe(4);

            const sportsConfig = VehiclePhysics.createSportsCar();
            const sports = new VehiclePhysics(sportsConfig);
            expect(sports.wheels.length).toBe(4);

            // Step each without crashing
            sedan.update(1 / 60);
            truck.update(1 / 60);
            sports.update(1 / 60);

            expect(Number.isFinite(sedan.speed)).toBe(true);
            expect(Number.isFinite(truck.speed)).toBe(true);
            expect(Number.isFinite(sports.speed)).toBe(true);
        });
    });

    describe('Scenario 11: Broadphase collision pair detection', () => {
        it('should detect overlapping pairs with sweep-and-prune', () => {
            const broadphase = new SweepAndPruneBroadphase('x');

            const bodyA = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 1.0,
                shape: new BoxShape(new Vector3(1, 1, 1)),
            });
            bodyA.setPosition(new Vector3(0, 0, 0));

            const bodyB = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 1.0,
                shape: new BoxShape(new Vector3(1, 1, 1)),
            });
            // Overlapping on X axis: bodyA covers [-1,1], bodyB covers [0.5, 2.5]
            bodyB.setPosition(new Vector3(1.5, 0, 0));

            broadphase.update([bodyA, bodyB]);
            const pairs = broadphase.getPairs();
            expect(pairs.length).toBe(1);
            expect(pairs[0].bodyA).toBe(bodyA);
            expect(pairs[0].bodyB).toBe(bodyB);
        });

        it('should not detect pairs for non-overlapping bodies', () => {
            const broadphase = new SweepAndPruneBroadphase('x');

            const bodyA = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 1.0,
                shape: new BoxShape(new Vector3(1, 1, 1)),
            });
            bodyA.setPosition(new Vector3(0, 0, 0));

            const bodyB = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 1.0,
                shape: new BoxShape(new Vector3(1, 1, 1)),
            });
            // Non-overlapping on X: bodyA covers [-1,1], bodyB covers [10, 12]
            bodyB.setPosition(new Vector3(11, 0, 0));

            broadphase.update([bodyA, bodyB]);
            const pairs = broadphase.getPairs();
            expect(pairs.length).toBe(0);
        });
    });

    describe('Scenario 12: Constraint solver with contacts', () => {
        it('should solve contacts without crashing', () => {
            const solver = new ConstraintSolver();

            const bodyA = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 1.0,
                shape: new SphereShape(1.0),
            });
            bodyA.setPosition(new Vector3(0, 0, 0));

            const bodyB = new RigidBody({
                type: RigidBodyType.DYNAMIC,
                mass: 1.0,
                shape: new SphereShape(1.0),
            });
            bodyB.setPosition(new Vector3(1.5, 0, 0));

            // Generate a manifold via narrowphase
            const manifold = Narrowphase.testCollision(
                bodyA.shape!,
                bodyA.getPosition(),
                bodyB.shape!,
                bodyB.getPosition()
            );

            expect(manifold).not.toBeNull();
            manifold!.bodyA = bodyA;
            manifold!.bodyB = bodyB;

            solver.prepareContacts([manifold!]);
            // Should not throw
            solver.solve(1 / 60);

            expect(solver.getContactConstraintCount()).toBeGreaterThan(0);
        });
    });
});
