import { Project, ComponentTemplate, Box } from '../types';
import { migrateRotation } from './rotation';

export interface SawdustExport {
  version: 1;
  exportedAt: string;
  project: Project;
  components: ComponentTemplate[];
}

export function exportProject(
  project: Project,
  components: ComponentTemplate[],
): void {
  const data: SawdustExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    project,
    components,
  };

  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^a-zA-Z0-9_-]/g, '_')}.sawdust.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function pickAndParseImportFile(): Promise<SawdustExport> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.sawdust.json';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result as string);

          if (!data.version || !data.project || !Array.isArray(data.project.boxes)) {
            reject(new Error('Invalid Sawdust file format'));
            return;
          }

          // Migrate legacy rotation format (number → {x,y,z})
          const migrateBoxes = (boxes: Box[]) => {
            for (const box of boxes) {
              box.rotation = migrateRotation(box.rotation as unknown as number | { x: number; y: number; z: number });
            }
          };
          migrateBoxes(data.project.boxes);
          if (Array.isArray(data.components)) {
            for (const comp of data.components) {
              if (Array.isArray(comp.boxes)) {
                migrateBoxes(comp.boxes);
              }
            }
          }

          resolve(data as SawdustExport);
        } catch {
          reject(new Error('Failed to parse file as JSON'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };

    input.click();
  });
}
