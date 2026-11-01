/**
 * Route template — re-mounts on every navigation, so each page fades/slides
 * in. Pure CSS (no client JS) keeps the shared bundle small.
 */
export default function Template({ children }) {
  return <div className="page-enter">{children}</div>;
}
