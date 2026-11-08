
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
    ChevronDown,
    Menu,
    X,
    ArrowUpRight,
    Moon,
    Sun
} from "lucide-react";

import Logo from "./Logo";
import { supabase } from "../services/supabase";

export default function Navbar() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [user, setUser] = useState(null);

    const [theme, setTheme] = useState(
        () => localStorage.getItem("fundchain-theme") || "light"
    );

    const location = useLocation();
    const closeMenu = () => setMobileOpen(false);

    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem("fundchain-theme", theme);
    }, [theme]);

    useEffect(() => {
        let mounted = true;

        async function checkUser() {
            const { data } = await supabase.auth.getUser();

            if (mounted) {
                setUser(data?.user || null);
            }
        }

        checkUser();

        const {
            data: { subscription }
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user || null);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const toggleTheme = () => {
        setTheme((current) =>
            current === "light" ? "dark" : "light"
        );
    };

    const themeButton = (
        <button
            type="button"
            className="fc-theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
            {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === "light" ? "Dark mode" : "Light mode"}</span>
        </button>
    );

    const accountActions = (
        <>
            {user ? (
                <Link
                    className="button button-dark button-small"
                    to="/dashboard"
                    onClick={closeMenu}
                >
                    Dashboard <ArrowUpRight size={15} />
                </Link>
            ) : (
                <>
                    <Link
                        className="nav-login"
                        to="/login"
                        onClick={closeMenu}
                    >
                        Log in
                    </Link>

                    <Link
                        className="button button-dark button-small"
                        to="/register"
                        onClick={closeMenu}
                    >
                        Get started <ArrowUpRight size={15} />
                    </Link>
                </>
            )}
        </>
    );

    return (
        <header className="site-header">
            <div className="nav-shell">
                <Logo />

                <button
                    className="mobile-menu-toggle"
                    onClick={() => setMobileOpen((open) => !open)}
                    aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
                    aria-expanded={mobileOpen}
                >
                    {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                </button>

                <nav
                    className={`main-nav${mobileOpen ? " is-open" : ""}`}
                    aria-label="Main navigation"
                >
                    <div className="nav-dropdown">
                        <Link
                            to="/explore-projects"
                            className="nav-link"
                            onClick={closeMenu}
                        >
                            Explore projects <ChevronDown size={14} />
                        </Link>

                        <div className="dropdown-panel">
                            <Link to="/explore-projects" onClick={closeMenu}>
                                <span>All projects</span>
                                <small>Ideas worth getting behind</small>
                            </Link>

                            <a href="/#how-it-works" onClick={closeMenu}>
                                <span>How it works</span>
                                <small>From first idea to shared impact</small>
                            </a>
                        </div>
                    </div>

                    <a className="nav-link" href="/#how-it-works" onClick={closeMenu}>
                        How it works
                    </a>

                    <a className="nav-link" href="/#about" onClick={closeMenu}>
                        About us
                    </a>

                    <a className="nav-link" href="/#faq" onClick={closeMenu}>
                        FAQ
                    </a>

                    <div className="nav-mobile-actions">
                        {themeButton}
                        {accountActions}
                    </div>
                </nav>

                <div className="nav-actions">
                    {themeButton}
                    {accountActions}
                </div>
            </div>

            {location.pathname !== "/" && (
                <div className="nav-route-spacer" />
            )}
        </header>
    );
}
