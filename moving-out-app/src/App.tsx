import { AppRoutes } from "./app/routes";
import { AppStateProvider } from "./app/state";
import "./App.css";

function App() {
  return (
    <AppStateProvider>
      <AppRoutes />
    </AppStateProvider>
  );
}

export default App;
