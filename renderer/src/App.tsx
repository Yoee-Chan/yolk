import { HashRouter, useRoutes } from "react-router-dom";
import routes from "./routes";
import './css/index.css'
function AppRoutes() {
  return useRoutes(routes);
}

export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}
