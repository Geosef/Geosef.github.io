import { Link } from 'react-router-dom';
import './GolfLeaderboard.css';

export default function NotFound() {
  return (
    <div className="gl-wrapper">
      <div className="gl-notfound">
        <p className="gl-notfound-code">404</p>
        <h1 className="gl-notfound-title">Out of bounds</h1>
        <p className="gl-notfound-text">We couldn’t find that page.</p>
        <Link to="/golf-leaderboard" className="gl-notfound-link">Back to the leaderboard</Link>
      </div>
    </div>
  );
}
