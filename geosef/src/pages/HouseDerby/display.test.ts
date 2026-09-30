import { describe, expect, it } from 'vitest';
import { boardLayout } from './display';

describe('boardLayout', () => {
  it('is the phone board without ?tv', () => {
    expect(boardLayout(null, true)).toBe('phone');
    expect(boardLayout(null, false)).toBe('phone');
  });

  it('follows the screen shape for a bare ?tv', () => {
    expect(boardLayout('', true)).toBe('portrait');
    expect(boardLayout('', false)).toBe('tv');
  });

  it('pins a layout when ?tv names one', () => {
    expect(boardLayout('vertical', false)).toBe('vertical');
    expect(boardLayout('vertical', true)).toBe('vertical');
    expect(boardLayout('landscape', true)).toBe('tv');
  });

  it('treats an unknown value like a bare ?tv', () => {
    expect(boardLayout('1', true)).toBe('portrait');
    expect(boardLayout('1', false)).toBe('tv');
  });
});
