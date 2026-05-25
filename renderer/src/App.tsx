import { HashRouter, useRoutes } from "react-router-dom";
import routes from "./routes";
import './css/index.css';
import './css/auth.css';
import { AuthProvider } from './context/AuthContext';

function AppRoutes() {
  return useRoutes(routes);
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </HashRouter>
  );
}
