// Every colour and size in one place. The palette is the one from the web
// prototype and it was run through a contrast/colour-blindness validator, so
// change values here rather than inventing new ones in a screen.
import { useColorScheme } from 'react-native';

const light = {
  ground:'#EAEEEC', surface:'#FFFFFF', surface2:'#DEE5E2', line:'#C7D1CD',
  ink:'#101A1D', ink2:'#43555A', ink3:'#71858A',
  accent:'#1183A6', accentSoft:'#DCEDF3',
  cheap:'#1F7A52', cheapBg:'#DAEBE1',
  pricey:'#B0442A', priceyBg:'#F5E0DA',
  onAccent:'#FFFFFF',
};
const dark = {
  ground:'#0A1114', surface:'#131C1F', surface2:'#1D2629', line:'#2A363A',
  ink:'#E6EDEB', ink2:'#9EAFB2', ink3:'#6F8286',
  accent:'#2E9CBB', accentSoft:'#0E2A33',
  cheap:'#3FA87B', cheapBg:'#12271F',
  pricey:'#D06A4C', priceyBg:'#2E1A15',
  onAccent:'#08161B',
};

export const space = { xs:4, s:8, m:12, l:16, xl:24 };
export const radius = { s:8, m:12, l:18 };
export function useTheme() { return useColorScheme() === 'dark' ? dark : light; }
