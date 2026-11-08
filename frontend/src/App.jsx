
import {
    BrowserRouter,
    Routes,
    Route,
    Navigate
} from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

// Pages
import LandingPage from "./pages/LandingPage";
import ExploreProjects from "./pages/ExploreProjects";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import CreateCampaign from "./pages/CreateCampaign";
import MyCampaigns from "./pages/MyCampaigns";
import MyContributions from "./pages/MyContributions";
import CampaignDetails from "./pages/CampaignDetails";

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>

                    {/* Public Routes */}
                    <Route
                        path="/"
                        element={<LandingPage />}
                    />

                    <Route
                        path="/explore-projects"
                        element={<ExploreProjects />}
                    />

                    <Route
                        path="/campaign/:id"
                        element={<CampaignDetails />}
                    />

                    <Route
                        path="/login"
                        element={<Login />}
                    />

                    <Route
                        path="/register"
                        element={<Register />}
                    />

                    <Route
                        path="/forgot-password"
                        element={<ForgotPassword />}
                    />

                    <Route
                        path="/reset-password"
                        element={<ResetPassword />}
                    />

                    {/* Protected Routes */}
                    <Route element={<ProtectedRoute />}>

                        <Route
                            path="/dashboard"
                            element={<Dashboard />}
                        />

                        <Route
                            path="/create-campaign"
                            element={<CreateCampaign />}
                        />

                        <Route
                            path="/my-campaigns"
                            element={<MyCampaigns />}
                        />

                        <Route
                            path="/my-donations"
                            element={<MyContributions />}
                        />

                    </Route>

                    {/* Unknown Routes */}
                    <Route
                        path="*"
                        element={<Navigate to="/" replace />}
                    />

                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
