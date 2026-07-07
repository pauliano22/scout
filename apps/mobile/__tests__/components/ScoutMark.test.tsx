import React from 'react';
import { render } from '@testing-library/react-native';
import { ScoutMark, Wordmark } from '../../src/components/common/ScoutMark';

describe('ScoutMark', () => {
  it('renders the letter "S"', () => {
    const { getByText } = render(<ScoutMark />);
    expect(getByText('S')).toBeTruthy();
  });

  it('renders with muted colors when muted is true', () => {
    const { getByText } = render(<ScoutMark muted />);
    expect(getByText('S')).toBeTruthy();
  });

  it('accepts custom size', () => {
    const { getByText } = render(<ScoutMark size={100} />);
    expect(getByText('S')).toBeTruthy();
  });
});

describe('Wordmark', () => {
  it('renders "Scout" text', () => {
    const { getByText } = render(<Wordmark />);
    expect(getByText('Scout')).toBeTruthy();
  });
});
