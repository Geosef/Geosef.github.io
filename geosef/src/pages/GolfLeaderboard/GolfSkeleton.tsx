import React from 'react';
import './GolfLeaderboard.css';

export function SkeletonLine({ width = '100%', height = '1rem' }: { width?: string; height?: string }) {
  return (
    <div className="gl-skeleton-bar" style={{ width, height, marginBottom: '0.4rem' }} />
  );
}

export function SkeletonTableRows({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  const widths = ['55%', '40%', '30%', '35%', '45%'];
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className={i % 2 === 0 ? 'gl-row-even' : ''}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}>
              <div
                className="gl-skeleton-bar"
                style={{ height: '0.85rem', width: widths[j % widths.length] }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function SkeletonDetailHeader() {
  return (
    <div className="gl-detail-header">
      <SkeletonLine width="3.5rem" height="0.75rem" />
      <SkeletonLine width="11rem" height="1.5rem" />
      <SkeletonLine width="7rem" height="0.8rem" />
    </div>
  );
}

export function SkeletonSection() {
  return (
    <div className="gl-detail-section">
      <SkeletonLine width="5rem" height="0.65rem" />
      <SkeletonLine width="100%" height="0.85rem" />
      <SkeletonLine width="88%" height="0.85rem" />
      <SkeletonLine width="72%" height="0.85rem" />
    </div>
  );
}
