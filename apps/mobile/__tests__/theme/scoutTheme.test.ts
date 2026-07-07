import { colors, spacing, radius, typography } from '../../src/theme/scoutTheme';

describe('scoutTheme', () => {
  describe('colors', () => {
    it('has brand colors defined', () => {
      expect(colors.red).toBe('#B31B1B');
      expect(colors.redSoft).toBe('#A32424');
      expect(colors.redDim).toBe('#F5E4E4');
    });

    it('has background colors defined', () => {
      expect(colors.background).toBe('#FAFAF8');
      expect(colors.surface).toBe('#FFFFFF');
    });

    it('has text colors defined', () => {
      expect(colors.textPrimary).toBe('#111111');
      expect(colors.textSecondary).toBe('#3F3F46');
      expect(colors.textInverse).toBe('#FFFFFF');
    });

    it('has status colors defined', () => {
      expect(colors.success).toBe('#16A34A');
      expect(colors.warning).toBe('#CA8A04');
      expect(colors.error).toBe('#C53030');
    });
  });

  describe('spacing', () => {
    it('has all spacing tokens', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(12);
      expect(spacing.lg).toBe(16);
      expect(spacing.xl).toBe(20);
      expect(spacing.xxl).toBe(24);
      expect(spacing.xxxl).toBe(32);
      expect(spacing.xxxxl).toBe(48);
    });
  });

  describe('radius', () => {
    it('has all radius tokens', () => {
      expect(radius.xs).toBe(6);
      expect(radius.sm).toBe(10);
      expect(radius.md).toBe(14);
      expect(radius.lg).toBe(18);
      expect(radius.xl).toBe(22);
      expect(radius.xxl).toBe(28);
      expect(radius.full).toBe(9999);
    });
  });

  describe('typography', () => {
    it('has largeTitle defined', () => {
      expect(typography.largeTitle.fontSize).toBe(34);
      expect(typography.largeTitle.fontWeight).toBe('700');
    });

    it('has body defined', () => {
      expect(typography.body.fontSize).toBe(17);
      expect(typography.body.lineHeight).toBe(25);
    });

    it('has all typography levels', () => {
      const levels = [
        'largeTitle', 'title1', 'title2', 'title3',
        'headline', 'body', 'callout', 'subhead',
        'footnote', 'caption1', 'caption2', 'eyebrow',
      ];
      for (const level of levels) {
        expect(typography[level as keyof typeof typography]).toBeDefined();
      }
    });
  });
});
