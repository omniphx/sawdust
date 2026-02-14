import Dexie, { type EntityTable } from 'dexie';
import { Project } from '../types';

const db = new Dexie('OpenCAD') as Dexie & {
  projects: EntityTable<Project, 'id'>;
};

db.version(1).stores({
  projects: 'id, name',
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

export { db };
