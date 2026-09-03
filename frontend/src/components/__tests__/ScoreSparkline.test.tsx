import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScoreSparkline from '../ScoreSparkline.js';

describe('ScoreSparkline', () => {
  it('hiện "Chưa đủ dữ liệu" khi không có điểm', () => {
    render(<ScoreSparkline points={[]} />);
    expect(screen.getByText('Chưa đủ dữ liệu')).toBeTruthy();
  });

  it('hiện "Chưa đủ dữ liệu" khi chỉ có 1 điểm', () => {
    render(<ScoreSparkline points={[{ score: 8 }]} />);
    expect(screen.getByText('Chưa đủ dữ liệu')).toBeTruthy();
  });

  it('render SVG khi có ≥2 điểm', () => {
    const { container } = render(<ScoreSparkline points={[{ score: 7 }, { score: 9 }]} />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('SVG có đường polyline', () => {
    const { container } = render(<ScoreSparkline points={[{ score: 5 }, { score: 8 }, { score: 6 }]} />);
    expect(container.querySelector('polyline')).toBeTruthy();
  });

  it('SVG có đúng số chấm tròn (circle) theo số điểm', () => {
    const { container } = render(
      <ScoreSparkline points={[{ score: 5 }, { score: 7 }, { score: 9 }]} />,
    );
    const circles = container.querySelectorAll('circle');
    expect(circles).toHaveLength(3);
  });

  it('không render khi mảng rỗng → không có SVG', () => {
    const { container } = render(<ScoreSparkline points={[]} />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('render được với nhiều điểm', () => {
    const points = Array.from({ length: 10 }, (_, i) => ({ score: i + 1 }));
    const { container } = render(<ScoreSparkline points={points} />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelectorAll('circle')).toHaveLength(10);
  });
});
