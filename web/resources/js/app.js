import React from 'react';
import { createRoot } from 'react-dom/client';

import './optidx/app.css';
import './optidx/canvas.css';
import './optidx/data.js';
import './optidx/data-presets.js';
import './optidx/icons.jsx';
import './optidx/tweaks-panel.jsx';
import './optidx/components/Logo.jsx';
import './optidx/components/Shell.jsx';
import './optidx/components/ScreenAuth.jsx';
import './optidx/components/ScreenHome.jsx';
import './optidx/components/ScreenWizard.jsx';
import './optidx/components/ScreenCanvas.jsx';
import './optidx/components/PropertiesPanel.jsx';
import './optidx/components/ScreenResults.jsx';
import './optidx/components/ScreenReport.jsx';
import './optidx/components/ScreenOther.jsx';
import './optidx/components/ScreenExtras.jsx';
import './optidx/components/App.jsx';

const mount = document.getElementById('app');

if (mount) {
    createRoot(mount).render(React.createElement(window.App));
}
