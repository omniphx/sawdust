import Dexie, { type EntityTable } from 'dexie';
import { Project, ComponentTemplate } from '../types';
import { migrateRotation } from './rotation';

const db = new Dexie('Sawdust') as Dexie & {
  projects: EntityTable<Project, 'id'>;
  components: EntityTable<ComponentTemplate, 'id'>;
};

db.version(1).stores({
  projects: 'id, name',
});

db.version(2).stores({
  projects: 'id, name',
  components: 'id, name, createdAt',
});

db.version(3).stores({
  projects: 'id, name',
  components: 'id, name, createdAt',
}).upgrade(tx => {
  return Promise.all([
    tx.table('projects').toCollection().modify((project: Project) => {
      for (const box of project.boxes) {
        box.rotation = migrateRotation(box.rotation as unknown as number | { x: number; y: number; z: number });
      }
    }),
    tx.table('components').toCollection().modify((component: ComponentTemplate) => {
      for (const box of component.boxes) {
        box.rotation = migrateRotation(box.rotation as unknown as number | { x: number; y: number; z: number });
      }
    }),
  ]);
});

export async function saveProject(project: Project): Promise<void> {
  await db.projects.put(project);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return db.projects.get(id);
}

export async function loadDefaultProject(): Promise<Project | undefined> {
  const projects = await db.projects.toArray();
  return projects[0];
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}

export async function getAllProjects(): Promise<Project[]> {
  return db.projects.toArray();
}

export async function saveComponent(component: ComponentTemplate): Promise<void> {
  await db.components.put(component);
}

export async function getAllComponents(): Promise<ComponentTemplate[]> {
  return db.components.orderBy('createdAt').reverse().toArray();
}

export async function deleteComponent(id: string): Promise<void> {
  await db.components.delete(id);
}

export { db };
