import "../styles/dashboard.css";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import { logoutUser } from "../services/auth";
import WalletConnect from "../components/WalletConnect";
import {
    Plus,
    Compass,
    FolderOpen,
    Heart,
    UserRound,
    Wallet,
    ArrowUpRight,
    LogOut,
    LayoutDashboard,
    Settings,
    Menu,
    X
} from "lucide-react";

export default function Dashboard() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mobileMenu, setMobileMenu] = useState(false);

    useEffect(() => {
        let mounted = true;

        async function loadProfile() {
            try {
                const {
                    data: { user },
                    error
                } = await supabase.auth.getUser();

                if (error || !user) {
                    navigate("/login");
                    return;
                }

                if (!mounted) return;

                setUser(user);

                const { data, error: profileError } =
                    await supabase
                        .from("profiles")
                        .select("username, full_name, role")
                        .eq("id", user.id)
                        .single();

                if (profileError) {
                    console.error(profileError.message);
                }

                if (mounted) setProfile(data);

            } catch (error) {
                console.error("Dashboard error:", error.message);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        loadProfile();

        return () => {
            mounted = false;
        };
    }, [navigate]);

    const handleLogout = async () => {
        try {
            await logoutUser();
            navigate("/login");
        } catch (error) {
            alert(error.message);
        }
    };

    const name =
        profile?.full_name ||
        profile?.username ||
        user?.email?.split("@")[0] ||
        "there";

    const sections = [
        {
            title: "Create a campaign",
            description: "Turn your idea into a project people can believe in.",
            icon: Plus,
            path: "/create-campaign",
            label: "Start a campaign",
            number: "01"
        },
        {
            title: "Explore projects",
            description: "Discover meaningful ideas and people worth supporting.",
            icon: Compass,
            path: "/explore-projects",
            label: "Discover projects",
            number: "02"
        },
        {
            title: "My campaigns",
            description: "Keep track of the projects you have created.",
            icon: FolderOpen,
            path: "/my-campaigns",
            label: "Manage campaigns",
            number: "03"
        },
        {
            title: "My contributions",
            description: "See the projects you have chosen to support.",
            icon: Heart,
            path: "/my-donations",
            label: "View contributions",
            number: "04"
        }
    ];

    if (loading) {
        return (
            <div className="fc-loading">
                <span className="fc-loading-mark">F.</span>
                <p>Preparing your space...</p>
            </div>
        );
    }

    return (
        <div className="fc-dashboard">

            {/* Sidebar */}
            <aside className={`fc-sidebar ${mobileMenu ? "fc-sidebar-open" : ""}`}>
                <div className="fc-brand" onClick={() => navigate("/")}>
                    <span className="fc-brand-symbol">F</span>
                    <span>FundChain</span>
                </div>

                <div className="fc-side-label">WORKSPACE</div>

                <button
                    className="fc-side-link fc-side-active"
                    onClick={() => navigate("/dashboard")}
                >
                    <LayoutDashboard size={18} />
                    Dashboard
                </button>

                {sections.map((item) => {
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.number}
                            className="fc-side-link"
                            onClick={() => navigate(item.path)}
                        >
                            <Icon size={18} />
                            {item.title}
                        </button>
                    );
                })}

                <div className="fc-sidebar-bottom">
                    <div className="fc-side-label">ACCOUNT</div>

                    <button
                        className="fc-side-link"
                        onClick={() =>
                            document.getElementById("fc-profile")?.scrollIntoView({
                                behavior: "smooth"
                            })
                        }
                    >
                        <UserRound size={18} />
                        My profile
                    </button>

                    <button
                        className="fc-side-link"
                        onClick={() =>
                            document.getElementById("fc-wallet")?.scrollIntoView({
                                behavior: "smooth"
                            })
                        }
                    >
                        <Wallet size={18} />
                        Wallet
                    </button>

                    <button
                        className="fc-side-link"
                        onClick={handleLogout}
                    >
                        <LogOut size={18} />
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main className="fc-main">

                {/* Top bar */}
                <header className="fc-topbar">
                    <button
                        className="fc-mobile-toggle"
                        onClick={() => setMobileMenu(!mobileMenu)}
                        aria-label="Toggle navigation"
                    >
                        {mobileMenu ? <X /> : <Menu />}
                    </button>

                    <div className="fc-breadcrumb">
                        Workspace <span>/</span> Dashboard
                    </div>

                    <div className="fc-topbar-right">
                        <span className="fc-user-initial">
                            {name.charAt(0).toUpperCase()}
                        </span>
                        <span className="fc-topbar-name">{name}</span>
                    </div>
                </header>

                <div className="fc-content">

                    {/* Welcome */}
                    <section className="fc-welcome">
                        <div>
                            <p className="fc-eyebrow">
                                YOUR FUNDCHAIN WORKSPACE
                            </p>

                            <h1>
                                Good to see you, <em>{name}.</em>
                            </h1>

                            <p className="fc-welcome-text">
                                A place to bring meaningful ideas to life,
                                discover projects and make a difference.
                            </p>
                        </div>

                        <button
                            className="fc-primary-button"
                            onClick={() => navigate("/create-campaign")}
                        >
                            <Plus size={18} />
                            Create a campaign
                        </button>
                    </section>

                    {/* Campaign options */}
                    <section className="fc-section">
                        <div className="fc-section-heading">
                            <div>
                                <p className="fc-eyebrow">GET STARTED</p>
                                <h2>Your next step</h2>
                            </div>

                            <span className="fc-section-note">
                                YOUR FUNDCHAIN JOURNEY
                            </span>
                        </div>

                        <div className="fc-action-grid">
                            {sections.map((item) => {
                                const Icon = item.icon;

                                return (
                                    <button
                                        key={item.number}
                                        className="fc-action-card"
                                        onClick={() => navigate(item.path)}
                                    >
                                        <div className="fc-card-top">
                                            <span className="fc-card-number">
                                                {item.number}
                                            </span>

                                            <span className="fc-card-icon">
                                                <Icon size={21} />
                                            </span>
                                        </div>

                                        <div>
                                            <h3>{item.title}</h3>
                                            <p>{item.description}</p>
                                        </div>

                                        <div className="fc-card-bottom">
                                            <span>{item.label}</span>
                                            <ArrowUpRight size={18} />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    {/* Profile and wallet */}
                    <section className="fc-section fc-account-section">
                        <div className="fc-section-heading">
                            <div>
                                <p className="fc-eyebrow">YOUR ACCOUNT</p>
                                <h2>Personal details</h2>
                            </div>
                        </div>

                        <div className="fc-account-grid">

                            <div className="fc-account-card" id="fc-profile">
                                <div className="fc-account-heading">
                                    <div className="fc-account-icon">
                                        <UserRound size={20} />
                                    </div>
                                    <div>
                                        <h3>Profile information</h3>
                                        <p>Your account details</p>
                                    </div>
                                </div>

                                <div className="fc-detail-row">
                                    <span>Full name</span>
                                    <strong>{profile?.full_name || "Not provided"}</strong>
                                </div>

                                <div className="fc-detail-row">
                                    <span>Email address</span>
                                    <strong>{user?.email}</strong>
                                </div>

                                <div className="fc-detail-row">
                                    <span>Username</span>
                                    <strong>{profile?.username || "Not provided"}</strong>
                                </div>

                                <div className="fc-detail-row">
                                    <span>Account type</span>
                                    <strong>{profile?.role || "User"}</strong>
                                </div>
                            </div>

                            <div className="fc-account-card" id="fc-wallet">
                                <div className="fc-account-heading">
                                    <div className="fc-account-icon">
                                        <Wallet size={20} />
                                    </div>
                                    <div>
                                        <h3>Wallet connection</h3>
                                        <p>Connect your Ethereum wallet</p>
                                    </div>
                                </div>

                                <WalletConnect />
                            </div>
                        </div>
                    </section>

                    {/* Footer */}
                    <footer className="fc-dashboard-footer">
                        <span>FundChain © 2026</span>
                        <span>Built around ideas worth believing in.</span>
                    </footer>
                </div>
            </main>
        </div>
    );
}
