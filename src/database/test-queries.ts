import { db } from './connection';
import { users, workspaces, projects, requirements } from './schema';
import { eq } from 'drizzle-orm';

// Test database queries
export const testQueries = async (): Promise<boolean> => {
  try {
    console.log('🧪 Testing database queries...');

    // Test 1: Create a test user
    console.log('  Creating test user...');
    const [testUser] = await db.insert(users).values({
      email: 'test@gastown.com',
      name: 'Test User',
      githubUsername: 'testuser',
    }).returning();

    if (!testUser) {
      throw new Error('Failed to create test user');
    }
    console.log(`    ✅ Created user: ${testUser.id}`);

    // Test 2: Create a test workspace
    console.log('  Creating test workspace...');
    const [testWorkspace] = await db.insert(workspaces).values({
      name: 'Test Workspace',
      slug: 'test-workspace',
      description: 'A test workspace for verification',
      ownerId: testUser.id,
    }).returning();

    if (!testWorkspace) {
      throw new Error('Failed to create test workspace');
    }
    console.log(`    ✅ Created workspace: ${testWorkspace.id}`);

    // Test 3: Create a test project
    console.log('  Creating test project...');
    const [testProject] = await db.insert(projects).values({
      name: 'Test Project',
      slug: 'test-project',
      description: 'A test project for verification',
      workspaceId: testWorkspace.id,
    }).returning();

    if (!testProject) {
      throw new Error('Failed to create test project');
    }
    console.log(`    ✅ Created project: ${testProject.id}`);

    // Test 4: Create a test requirement
    console.log('  Creating test requirement...');
    const [testRequirement] = await db.insert(requirements).values({
      title: 'Test Requirement',
      description: 'A test requirement for verification',
      projectId: testProject.id,
      authorId: testUser.id,
      priority: 1,
      status: 'active',
      type: 'feature',
    }).returning();

    if (!testRequirement) {
      throw new Error('Failed to create test requirement');
    }
    console.log(`    ✅ Created requirement: ${testRequirement.id}`);

    // Test 5: Query all data to verify relationships
    console.log('  Testing query with relationships...');
    const allUsers = await db.select().from(users);
    const allWorkspaces = await db.select().from(workspaces);
    const allProjects = await db.select().from(projects);
    const allRequirements = await db.select().from(requirements);

    console.log(`    ✅ Found ${allUsers.length} users`);
    console.log(`    ✅ Found ${allWorkspaces.length} workspaces`);
    console.log(`    ✅ Found ${allProjects.length} projects`);
    console.log(`    ✅ Found ${allRequirements.length} requirements`);

    // Test 6: Query with joins
    console.log('  Testing complex query with joins...');
    const requirementsWithAuthors = await db
      .select({
        requirement: requirements,
        author: users,
        project: projects,
      })
      .from(requirements)
      .innerJoin(users, eq(requirements.authorId, users.id))
      .innerJoin(projects, eq(requirements.projectId, projects.id));

    console.log(`    ✅ Found ${requirementsWithAuthors.length} requirements with author and project data`);

    // Clean up test data
    console.log('  Cleaning up test data...');
    await db.delete(requirements).where(eq(requirements.id, testRequirement.id));
    await db.delete(projects).where(eq(projects.id, testProject.id));
    await db.delete(workspaces).where(eq(workspaces.id, testWorkspace.id));
    await db.delete(users).where(eq(users.id, testUser.id));
    console.log('    ✅ Test data cleaned up');

    console.log('🎉 All database query tests passed!');
    return true;
  } catch (error) {
    console.error('❌ Database query tests failed:', error);
    return false;
  }
};

// Standalone test runner script
if (require.main === module) {
  testQueries()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test execution failed:', error);
      process.exit(1);
    });
}