import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';

const navItems = [
  { path: '/', label: '时光', icon: '⏱️' },
  { path: '/gallery', label: '画廊', icon: '🖼️' },
  { path: '/add', label: '记录', icon: '➕', isAction: true },
  { path: '/calendar', label: '日历', icon: '📅' },
  { path: '/profile', label: '我的', icon: '👤' },
];

interface BottomNavProps {
  onAddClick?: () => void;
}

export default function BottomNav({ onAddClick }: BottomNavProps) {
  const location = useLocation();
  const hideNavPaths = ['/login', '/detail/'];
  const shouldHide = hideNavPaths.some((path) =>
    location.pathname.startsWith(path)
  );

  if (shouldHide) return null;

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        if (item.isAction) {
          return (
            <button
              key={item.path}
              type="button"
              className="nav-item action"
              onClick={onAddClick}
            >
              <motion.span
                className="nav-icon"
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                {item.icon}
              </motion.span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        }

        return (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `nav-item ${isActive ? 'active' : ''}`
            }
          >
            {({ isActive }) => (
              <>
                <motion.span
                  className="nav-icon"
                  whileTap={{ scale: 0.88 }}
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                  }}
                >
                  {item.icon}
                </motion.span>
                <span className="nav-label">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="active-indicator"
                    transition={{
                      type: 'spring',
                      stiffness: 500,
                      damping: 30,
                    }}
                  />
                )}
              </>
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
