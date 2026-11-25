(function (root) {
  'use strict';

  function color(value) {
    return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : '';
  }

  function foreground(background) {
    const channels = background.slice(1).match(/../g).map(part => {
      const channel = parseInt(part, 16) / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    const luminance = channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
    return luminance > .179 ? '#000000' : '#ffffff';
  }

  function themeCss(settings = {}) {
    const fields = settings || {};
    const bg = color(fields.c2);
    const fg = color(fields.c3) || (bg && foreground(bg));
    const primary = color(fields.c1) || (bg && fg);
    const secondary = color(fields.c4);
    const mix = (first, second, amount) => `color-mix(in oklab,${first} ${amount}%,${second})`;
    const values = {
      '--bg': bg,
      '--fg': fg,
      '--primary': primary,
      '--primary-fg': color(fields.buttonTextColor) ||
        (primary && (color(fields.c1) ? foreground(primary) : bg)),
      '--secondary': secondary || (bg && mix(bg, fg, 90)),
      '--card': color(fields.cardColor) || (bg && mix(bg, fg, 94)),
      '--border': color(fields.borderColor) || (bg && mix(bg, fg, 86)),
      '--muted': color(fields.mutedColor) || (bg && mix(fg, bg, 68)),
      '--ring': (bg && mix(bg, fg, 50)),
      '--cf-tint': bg && mix(bg, fg, 94),
      '--cf-frame': color(fields.borderColor) || (bg && mix(bg, fg, 74)),
      '--cf-strong': bg && mix(bg, fg, 40),
      'color-scheme': bg && (foreground(bg) === '#000000' ? 'light' : 'dark'),
      '--link-color': color(fields.linkColor),
      '--star': color(fields.starColor),
      '--shade': color(fields.bannerShadeColor),
      '--banner-text': color(fields.bannerTextColor),
      '--header-bg': color(fields.headerColor),
      '--header-fg': color(fields.headerColor) && foreground(fields.headerColor),
      '--footer-bg': color(fields.footerColor),
      '--footer-fg': color(fields.footerColor) && foreground(fields.footerColor),
      '--store': color(fields.storeColor),
      '--store-h': color(fields.storeColor) && mix(fields.storeColor, foreground(fields.storeColor), 84),
      '--store-fg': color(fields.storeColor) && foreground(fields.storeColor),
      '--cf-glow': color(fields.weekGlowColor) && mix(fields.weekGlowColor, 'transparent', 45),
      '--cf-floor': color(fields.weekGlowColor) && mix(fields.weekGlowColor, 'transparent', 25)
    };
    const size = Number(fields.fz);
    if (Number.isFinite(size) && size >= 12 && size <= 24) values['font-size'] = size + 'px';
    const declarations = Object.entries(values).filter(([, value]) => value).map(([key, value]) => key + ':' + value);
    return declarations.length ? ':root:root:root{' + declarations.join(';') + '}' : '';
  }

  if (typeof module === 'object' && module.exports) module.exports = themeCss;
  else root.siteThemeCss = themeCss;
})(globalThis);
