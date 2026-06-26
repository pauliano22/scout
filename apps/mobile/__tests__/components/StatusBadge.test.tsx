import React from 'react';
import { render } from '@testing-library/react-native';
import StatusBadge from '../../src/components/common/StatusBadge';

describe('StatusBadge', () => {
  it('renders "Saved" for saved status', () => {
    const { getByText } = render(<StatusBadge status="saved" />);
    expect(getByText('Saved')).toBeTruthy();
  });

  it('renders "Draft Ready" for message_drafted status', () => {
    const { getByText } = render(<StatusBadge status="message_drafted" />);
    expect(getByText('Draft Ready')).toBeTruthy();
  });

  it('renders "Contacted" for contacted status', () => {
    const { getByText } = render(<StatusBadge status="contacted" />);
    expect(getByText('Contacted')).toBeTruthy();
  });

  it('renders "Replied" for replied status', () => {
    const { getByText } = render(<StatusBadge status="replied" />);
    expect(getByText('Replied')).toBeTruthy();
  });

  it('renders "Meeting Set" for meeting_set status', () => {
    const { getByText } = render(<StatusBadge status="meeting_set" />);
    expect(getByText('Meeting Set')).toBeTruthy();
  });

  it('renders the raw status string for unknown statuses', () => {
    const { getByText } = render(<StatusBadge status="unknown_status" />);
    expect(getByText('unknown_status')).toBeTruthy();
  });
});
