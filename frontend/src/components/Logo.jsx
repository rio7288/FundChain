import { Link } from "react-router-dom";

export default function Logo({ light = false, compact = false, to = "/" }) {
    return (
        <Link className={`brand-mark${light ? " brand-mark-light" : ""}`} to={to} aria-label="FundChain home">
            <svg className="brand-symbol" viewBox="0 0 42 42" fill="none" aria-hidden="true">
                <path d="M11 13.5 21 7l10 6.5v12L21 32l-10-6.5v-12Z" stroke="currentColor" strokeWidth="1.7" />
                <path d="m11.5 13.5 9.5 6 9.5-6M21 19.5V31" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                <circle cx="11" cy="13.5" r="3" fill="#879071" />
                <circle cx="31" cy="13.5" r="3" fill="#879071" />
                <circle cx="21" cy="32" r="3" fill="#879071" />
            </svg>
            {!compact && <span>FundChain</span>}
        </Link>
    );
}
