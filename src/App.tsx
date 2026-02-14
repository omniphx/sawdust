import { ProjectProvider } from './store/projectStore';
import { Toolbar } from './components/layout/Toolbar';
import { Viewport } from './components/viewport/Viewport';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { BOMPanel } from './components/layout/BOMPanel';

function App() {
  return (
    <ProjectProvider>
      <div className="h-screen flex flex-col bg-gray-900">
        <Toolbar />
        <div className="flex-1 flex overflow-hidden">
          <Viewport />
          <PropertiesPanel />
          <BOMPanel />
        </div>
      </div>
    </ProjectProvider>
  );
}

export default App;
