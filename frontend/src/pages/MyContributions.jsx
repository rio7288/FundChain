
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    ArrowUpRight,
    Heart,
    Wallet,
    ExternalLink,
    RefreshCw,
    FolderOpen
} from "lucide-react";
import { formatEther } from "ethers";

import { supabase } from "../services/supabase";
import "../styles/my-contributions.css";

export default function MyContributions() {
    const navigate = useNavigate();

    const [donations, setDonations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function loadDonations() {
        setLoading(true);
        setError("");

        try {
            const {
                data: { user },
                error: authError
            } = await supabase.auth.getUser();

            if (authError || !user) {
                navigate("/login");
                return;
            }

            const { data, error: donationError } = await supabase
                .from("donations")
                .select(`
                    id,
                    campaign_id,
                    donor_id,
                    wallet_address,
                    amount_wei,
                    tx_hash,
                    block_number,
                    is_anonymous,
                    created_at,
                    campaigns (
                        title,
                        category,
                        image_url
                    )
                `)
                .eq("donor_id", user.id)
                .order("created_at", { ascending: false });

            if (donationError) throw donationError;

            setDonations(data || []);
        } catch (err) {
            console.error("My contributions error:", err);
            setError("We couldn't load your contributions. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadDonations();
    }, []);

    const totalWei = donations.reduce(
        (total, donation) => total + BigInt(donation.amount_wei || 0),
        0n
    );

    const totalEth = formatEther(totalWei);

    const supportedProjects = new Set(
        donations.map((donation) => donation.campaign_id)
    ).size;

    const formatAmount = (amount) => {
        try {
            return `${Number(formatEther(BigInt(amount))).toLocaleString(
                "en-IN",
                { maximumFractionDigits: 6 }
            )} ETH`;
        } catch {
            return "—";
        }
    };

    const formatDate = (date) => {
        if (!date) return "Date unavailable";

        return new Date(date).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };

    return (
        <main className="contributions-page">
            <div className="contributions-container">
                <Link to="/dashboard" className="contributions-back">
                    <ArrowLeft size={16} />
                    Back to dashboard
                </Link>

                <header className="contributions-header">
                    <div>
                        <p className="contributions-eyebrow">
                            YOUR IMPACT, IN ONE PLACE
                        </p>
                        <h1>
                            My <em>contributions.</em>
                        </h1>
                        <p className="contributions-subtitle">
                            Every contribution helps an idea move closer
                            to becoming reality.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="contributions-refresh"
                        onClick={loadDonations}
                        disabled={loading}
                    >
                        <RefreshCw size={15} />
                        Refresh
                    </button>
                </header>

                <section className="contributions-stats">
                    <article className="contributions-stat">
                        <span>Total contributed</span>
                        <strong>{Number(totalEth).toLocaleString("en-IN", {
                            maximumFractionDigits: 6
                        })} ETH</strong>
                        <small>Recorded on-chain donations</small>
                    </article>

                    <article className="contributions-stat">
                        <span>Projects supported</span>
                        <strong>{supportedProjects}</strong>
                        <small>Unique campaigns supported</small>
                    </article>

                    <article className="contributions-stat">
                        <span>Total donations</span>
                        <strong>{donations.length}</strong>
                        <small>Recorded donation transactions</small>
                    </article>
                </section>

                <section className="contributions-history">
                    <div className="contributions-history-heading">
                        <div>
                            <p className="contributions-eyebrow">
                                YOUR GIVING HISTORY
                            </p>
                            <h2>Donation history</h2>
                        </div>
                        <span>{donations.length} records</span>
                    </div>

                    {loading && (
                        <div className="contributions-message">
                            <RefreshCw size={22} className="contributions-spin" />
                            <p>Loading your contributions...</p>
                        </div>
                    )}

                    {!loading && error && (
                        <div className="contributions-message contributions-error">
                            <p>{error}</p>
                            <button type="button" onClick={loadDonations}>
                                Try again
                            </button>
                        </div>
                    )}

                    {!loading && !error && donations.length === 0 && (
                        <div className="contributions-empty">
                            <div className="contributions-empty-icon">
                                <Heart size={25} />
                            </div>
                            <h3>Your impact story starts here.</h3>
                            <p>
                                You haven't made any recorded donations yet.
                                Explore projects and support an idea you believe in.
                            </p>
                            <Link
                                to="/explore-projects"
                                className="contributions-explore-button"
                            >
                                <FolderOpen size={16} />
                                Explore projects
                                <ArrowUpRight size={15} />
                            </Link>
                        </div>
                    )}

                    {!loading && !error && donations.length > 0 && (
                        <div className="contributions-list">
                            {donations.map((donation) => {
                                const campaign = Array.isArray(donation.campaigns)
                                    ? donation.campaigns[0]
                                    : donation.campaigns;

                                return (
                                    <article
                                        className="contribution-item"
                                        key={donation.id}
                                    >
                                        <div className="contribution-image">
                                            {campaign?.image_url ? (
                                                <img
                                                    src={campaign.image_url}
                                                    alt={campaign.title || "Campaign"}
                                                />
                                            ) : (
                                                <Heart size={22} />
                                            )}
                                        </div>

                                        <div className="contribution-details">
                                            <span className="contribution-category">
                                                {campaign?.category || "Community project"}
                                            </span>
                                            <h3>
                                                {campaign?.title || "Campaign"}
                                            </h3>
                                            <p>{formatDate(donation.created_at)}</p>
                                            {donation.is_anonymous && (
                                                <small>Anonymous contribution</small>
                                            )}
                                        </div>

                                        <div className="contribution-amount">
                                            <strong>
                                                {formatAmount(donation.amount_wei)}
                                            </strong>
                                            <span>ETH donation</span>
                                        </div>

                                        <div className="contribution-transaction">
                                            {donation.tx_hash ? (
                                                <a
                                                    href={`https://sepolia.etherscan.io/tx/${donation.tx_hash}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    View transaction
                                                    <ExternalLink size={13} />
                                                </a>
                                            ) : (
                                                <span>Transaction unavailable</span>
                                            )}
                                            {donation.block_number && (
                                                <small>
                                                    Block {donation.block_number}
                                                </small>
                                            )}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                <footer className="contributions-footer">
                    <span>FundChain © 2026</span>
                    <span>Every contribution carries a possibility.</span>
                </footer>
            </div>
        </main>
    );
}
