import { useEffect } from 'react';
import TopBar from './components/TopBar';
import { glitchNoise } from './engine/render/glitch';
import { resetFontRatio } from './engine/render/glyph';
import { resetTimeline, tick } from './engine/render/timeline';
import { setStatus } from './ui/status';

/**
 * Layout skeleton — containers copied as-is from the original index.html.
 * Section contents are added step by step (INVENTORY.md order):
 *   §2 settingsPop content · §3–§7 left-panel sections · §9 #viewSel
 */
export default function App() {
  useEffect(() => {
    // INIT (main.ts L694–703, as-is; renderLayerList/renderLayerProps land with §3/§4)
    if (document.fonts && document.fonts.load) {
      document.fonts.load('20px VT323').then(() => { resetFontRatio(); }).catch(() => {});
    }
    glitchNoise();
    resetTimeline(true);
    tick();
    setStatus('READY — ADD AN IMAGE TO BEGIN');
  }, []);

  return (
    <>
      <TopBar />

      {/* §2 SETTINGS POPUP content lands here */}
      <div className="pop" id="settingsPop"></div>

      <div className="main">
        <div className="left" id="leftPanel">
          {/* §3 LAYERS · §5 ROLL SWAP · §6 GLITCH · §7 EXPORT land here */}
          <div className="status" id="status">READY.</div>
        </div>

        <div className="right">
          <div className="right-bar"><span id="modeLabel">GLYPH MODE</span><span id="dimInfo">—</span></div>
          <div className="output-wrap" id="outputWrap">
            <canvas id="outCv"></canvas>
            <div id="thumbStrip"></div>
            {/* §9 #viewSel lands here */}
          </div>
        </div>
      </div>
    </>
  );
}
