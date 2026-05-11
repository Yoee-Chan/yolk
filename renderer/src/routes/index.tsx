import {RouteObject} from "react-router-dom";
import Demo from "../pages/demo";
import Main from "../pages/main/main"

const routes: RouteObject[] = [
    {
        path: "/",
        element: <Main/>,
        // element: <Demo/>,
    },
    {
        path: "/demo",
        element: <Demo/>,
    }
];
export default routes;
