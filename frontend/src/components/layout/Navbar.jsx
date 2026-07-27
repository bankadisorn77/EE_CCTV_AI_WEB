import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { decodeToken, logout, isAuthenticated } from "../../services/apiAuth";
import { cn } from "../../lib/utils";

const NAV_LINKS = [
  { label: "Home",       href: "/"           },
  { label: "Monitoring", href: "/monitoring"  },
  { label: "Settings",   href: "/settings"    },
  { label: "Register",   href: "/register"    },
  { label: "User Management", href: "/users", adminOnly: true },
];

// ── Variant maps ──────────────────────────────────────────────────────────────

const navLinkVariants = {
  active:   "text-indigo-600 bg-indigo-50",
  inactive: "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
};

const mobileLinkVariants = {
  active:   "text-indigo-600 bg-indigo-50",
  inactive: "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [scrolled,      setScrolled]      = useState(false);
  const [loginstatus,   setLoginStatus]   = useState(false);
  const [tokenDetails,  setTokenDetails]  = useState(null);

  const navigate = useNavigate();
  const location = useLocation();

  const active =
    NAV_LINKS.slice().reverse().find(({ href }) => location.pathname === href)?.label ?? "Home";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setLoginStatus(isAuthenticated());
    setTokenDetails(decodeToken());
  }, []);

  function checkLogin() {
    if (loginstatus) {
      logout(); // เรียกใช้ฟังก์ชันที่เคลียร์ Token ออกจาก sessionStorage ได้อย่างถูกต้อง
      setLoginStatus(false);
    }
    navigate("/login");
  }

  const visibleLinks = NAV_LINKS.filter(({ label, adminOnly }) => {
    if (adminOnly) return tokenDetails?.role === 'admin';
    if (label === "Register") return tokenDetails?.role !== "user";
    return true;
  });

  return (
    <nav className={cn(
      "w-full sticky top-0 z-50 bg-white transition-all duration-300",
      scrolled && "shadow-md border-b border-gray-200"
    )}>
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-extrabold text-xl text-gray-900 tracking-tight select-none">
          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          AI Suspected Monitoring System
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-1">
          {visibleLinks.map(({ label, href }) => (
            <li key={label}>
                <Link
                to={href}
                className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200", navLinkVariants[active === label ? "active" : "inactive"])}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>



        {/* Desktop CTA */}
        <button
          onClick={checkLogin}
          className="hidden md:inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 hover:-translate-y-0.5 shadow-sm"
        >
          {loginstatus ? "Logout" : "Login"}
        </button>

        {/* Hamburger */}
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          className="md:hidden flex flex-col justify-center gap-1.5 w-9 h-9 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <span className={cn("block h-0.5 w-6 bg-gray-700 rounded transition-all duration-300 origin-center", menuOpen && "translate-y-2 rotate-45")} />
          <span className={cn("block h-0.5 bg-gray-700 rounded transition-all duration-300",                    menuOpen ? "w-0 opacity-0" : "w-4 opacity-100")} />
          <span className={cn("block h-0.5 w-6 bg-gray-700 rounded transition-all duration-300 origin-center", menuOpen && "-translate-y-2 -rotate-45")} />
        </button>
      </div>

      {/* Mobile menu */}

      <div className={cn(
        "md:hidden overflow-hidden transition-all duration-300 ease-in-out bg-white border-t border-gray-100",
        menuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
      )}>
        <div className="px-4 py-4 flex flex-col gap-1">
          {visibleLinks.map(({ label, href }) => (
            <Link
              key={label}
              to={href}
              onClick={() => setMenuOpen(false)}
              className={cn("px-4 py-3 rounded-lg text-sm font-medium transition-colors", mobileLinkVariants[active === label ? "active" : "inactive"])}
            >
              {label}
            </Link>
          ))}
          <button
            onClick={checkLogin}
            className="mt-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-3 rounded-lg transition-colors"
          >
            {loginstatus ? "Logout" : "Login"}
          </button>
        </div>
      </div>
    </nav>
  );
}
