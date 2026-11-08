
import { useEffect, useMemo, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    ArrowLeft,
    ArrowUpRight,
    Compass,
    HandHeart,
    Search,
    SlidersHorizontal,
    RefreshCw
} from "lucide-react";
import { formatEther } from "ethers";

import { supabase } from "../services/supabase";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

import "../styles/explore-projects.css";

const categories = [
    "All",
    "Education",
    "Healthcare",
    "Technology",
    "Environment",
    "Social",
    "Business",
    "Other"
];

export default function ExploreProjects() {
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [user, setUser] = useState(null);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [sortBy, setSortBy] = useState("newest");

    const loadCampaigns = useCallback(async (isRefresh = false) => {
        if (isRefresh) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }

        setError("");

        try {
            const [
                { data: authData, error: authError },
                { data, error: campaignError }
            ] = await Promise.all([
                supabase.auth.getUser(),
                supabase
                    .from("campaigns")
                    .select(`
                        id,
                        title,
                        description,
                        category,
                        image_url,
                        target_amount_wei,
                        deadline,
                        created_at
                    `)
                    .eq("status", "active")
                    .order("created_at", { ascending: false })
            ]);

            if (authError) throw authError;
            if (campaignError) throw campaignError;

            setUser(authData?.user || null);
            setCampaigns(data || []);
        } catch (err) {
            console.error("Explore projects error:", err);

            setError(
                err.message ||
                "We couldn't load projects right now. Please try again."
            );
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadCampaigns();

    }, [loadCampaigns]);

    const formatGoal = (amount) => {
        try {
            if (!amount) return "Goal unavailable";

            return `${Number(
                formatEther(BigInt(amount))
            ).toLocaleString("en-US", {
                maximumFractionDigits: 4
            })} ETH`;
        } catch {
            return "Goal unavailable";
        }
    };

    const filteredCampaigns = useMemo(() => {
        let result = [...campaigns];

        // Search title and description
        if (search.trim()) {
            const query = search.trim().toLowerCase();

            result = result.filter((campaign) =>
                `${campaign.title || ""} ${campaign.description || ""} ${campaign.category || ""}`
                    .toLowerCase()
                    .includes(query)
            );
        }

        // Filter category
        if (selectedCategory !== "All") {
            result = result.filter(
                (campaign) =>
                    campaign.category?.toLowerCase() ===
                    selectedCategory.toLowerCase()
            );
        }

        // Sorting
        result.sort((a, b) => {
            if (sortBy === "oldest") {
                return new Date(a.created_at) - new Date(b.created_at);
            }

            if (sortBy === "deadline") {
                return new Date(a.deadline) - new Date(b.deadline);
            }

            return new Date(b.created_at) - new Date(a.created_at);
        });

        return result;
    }, [campaigns, search, selectedCategory, sortBy]);

    return (
        <div className="explore-page">
            <Navbar />

            <main className="explore-container">

                {/* Top navigation */}
                <div className="explore-topline">
                    <Link
                        to={user ? "/dashboard" : "/"}
                        className="explore-back-link"
                    >
                        <ArrowLeft size={16} />
                        {user ? "Back to dashboard" : "Back to home"}
                    </Link>

                    <span className="explore-eyebrow">
                        <Compass size={15} />
                        THE CAMPAIGN LIBRARY
                    </span>
                </div>

                {/* Page heading */}
                <section className="explore-heading">
                    <div>
                        <p className="eyebrow">
                            IDEAS WORTH GETTING BEHIND
                        </p>

                        <h1>
                            Explore <em>projects.</em>
                        </h1>

                        <p>
                            Discover meaningful ideas and the people
                            working to bring them to life.
                        </p>
                    </div>

                    {user && (
                        <Link
                            to="/create-campaign"
                            className="button button-dark"
                        >
                            Start a campaign
                            <ArrowUpRight size={16} />
                        </Link>
                    )}
                </section>

                {/* Search and filters */}
                <section className="explore-toolbar">

                    <div className="explore-search">
                        <Search size={19} />

                        <input
                            type="search"
                            placeholder="Search projects, ideas or causes..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />

                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch("")}
                                aria-label="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    <div className="explore-sort">
                        <SlidersHorizontal size={17} />

                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value)}
                            aria-label="Sort campaigns"
                        >
                            <option value="newest">Newest first</option>
                            <option value="oldest">Oldest first</option>
                            <option value="deadline">Ending soonest</option>
                        </select>
                    </div>

                    <button
                        type="button"
                        className="explore-refresh"
                        onClick={() => loadCampaigns(true)}
                        disabled={loading || refreshing}
                    >
                        <RefreshCw
                            size={16}
                            className={refreshing ? "explore-spinning" : ""}
                        />
                        Refresh
                    </button>
                </section>

                {/* Category filters */}
                <section className="explore-categories">
                    {categories.map((category) => (
                        <button
                            key={category}
                            type="button"
                            className={
                                selectedCategory === category
                                    ? "explore-category active"
                                    : "explore-category"
                            }
                            onClick={() => setSelectedCategory(category)}
                        >
                            {category}
                        </button>
                    ))}
                </section>

                {/* Results count */}
                {!loading && !error && (
                    <div className="explore-results-info">
                        <p>
                            Showing <strong>{filteredCampaigns.length}</strong>{" "}
                            of <strong>{campaigns.length}</strong> active projects
                        </p>
                    </div>
                )}

                {/* Loading */}
                {loading && (
                    <div className="explore-empty">
                        <RefreshCw size={24} className="explore-spinning" />
                        <h2>Finding projects...</h2>
                        <p>Loading active campaigns from FundChain.</p>
                    </div>
                )}

                {/* Error */}
                {!loading && error && (
                    <div className="explore-empty">
                        <h2>Something went wrong.</h2>
                        <p>{error}</p>

                        <button
                            className="button button-dark"
                            onClick={() => loadCampaigns()}
                        >
                            Try again
                        </button>
                    </div>
                )}

                {/* No active campaigns */}
                {!loading && !error && campaigns.length === 0 && (
                    <div className="explore-empty">
                        <HandHeart size={30} />

                        <h2>The next great idea could start here.</h2>

                        <p>
                            There are no active public campaigns yet.
                            Check back as the FundChain community grows.
                        </p>

                        {user && (
                            <Link
                                to="/create-campaign"
                                className="text-link"
                            >
                                Create a campaign
                                <ArrowUpRight size={15} />
                            </Link>
                        )}
                    </div>
                )}

                {/* No search results */}
                {!loading &&
                    !error &&
                    campaigns.length > 0 &&
                    filteredCampaigns.length === 0 && (
                        <div className="explore-empty">
                            <Search size={28} />

                            <h2>No matching projects found.</h2>

                            <p>
                                Try another search or select a different category.
                            </p>

                            <button
                                className="button button-dark"
                                onClick={() => {
                                    setSearch("");
                                    setSelectedCategory("All");
                                }}
                            >
                                Clear filters
                            </button>
                        </div>
                    )}

                {/* Campaign cards */}
                {!loading &&
                    !error &&
                    filteredCampaigns.length > 0 && (
                        <div className="explore-grid">
                            {filteredCampaigns.map((campaign) => (
                                <Link
                                    to={`/campaign/${campaign.id}`}
                                    className="explore-card-link"
                                    key={campaign.id}
                                >
                                    <article className="explore-card">

                                        <div className="explore-card-image">
                                            {campaign.image_url ? (
                                                <img
                                                    src={campaign.image_url}
                                                    alt={campaign.title}
                                                    loading="lazy"
                                                />
                                            ) : (
                                                <div className="explore-image-placeholder">
                                                    FC
                                                </div>
                                            )}

                                            <span>
                                                {campaign.category || "Community project"}
                                            </span>
                                        </div>

                                        <div className="explore-card-content">
                                            <h2>{campaign.title}</h2>

                                            <p>{campaign.description}</p>

                                            <div className="explore-card-meta">
                                                <div>
                                                    <small>Funding goal</small>

                                                    <strong>
                                                        {formatGoal(
                                                            campaign.target_amount_wei
                                                        )}
                                                    </strong>
                                                </div>

                                                <div>
                                                    <small>Deadline</small>

                                                    <strong>
                                                        {campaign.deadline
                                                            ? new Date(
                                                                campaign.deadline
                                                            ).toLocaleDateString(
                                                                "en-IN",
                                                                {
                                                                    day: "numeric",
                                                                    month: "short",
                                                                    year: "numeric"
                                                                }
                                                            )
                                                            : "Not specified"}
                                                    </strong>
                                                </div>
                                            </div>

                                            <div className="explore-card-action">
                                                View project
                                                <ArrowUpRight size={17} />
                                            </div>
                                        </div>
                                    </article>
                                </Link>
                            ))}
                        </div>
                    )}

            </main>

            <Footer />
        </div>
    );
}
