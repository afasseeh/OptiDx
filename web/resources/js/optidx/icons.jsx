// Icons — tiny inline SVG set (Lucide-style)
window.Icon = function Icon({ name, size = 16, stroke = 1.8, className, style }) {
  const paths = window.ICON_PATHS[name] || window.ICON_PATHS["square"];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      className={className} style={style}>
      {paths}
    </svg>
  );
};

window.ICON_PATHS = {
  "home":          <><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9v12h14V9"/></>,
  "layout-grid":   <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>,
  "git-branch":    <><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 8v8M18 10v1a4 4 0 0 1-4 4H8"/></>,
  "flask":         <><path d="M9 3h6v5l5 10a2 2 0 0 1-1.8 3H5.8A2 2 0 0 1 4 18l5-10V3Z"/><path d="M7 14h10"/></>,
  "database":      <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></>,
  "bar-chart":     <><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20v-4"/></>,
  "settings":      <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></>,
  "help":          <><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></>,
  "plus":          <><path d="M12 5v14M5 12h14"/></>,
  "search":        <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>,
  "chevron-right": <><path d="m9 6 6 6-6 6"/></>,
  "chevron-left":  <><path d="m15 6-6 6 6 6"/></>,
  "chevron-down":  <><path d="m6 9 6 6 6-6"/></>,
  "x":             <><path d="M18 6 6 18M6 6l12 12"/></>,
  "check":         <><path d="M20 6 9 17l-5-5"/></>,
  "alert":         <><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></>,
  "alert-triangle":<><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/></>,
  "alert-circle":  <><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></>,
  "crosshair":     <><circle cx="12" cy="12" r="10"/><path d="M22 12h-4M6 12H2M12 6V2M12 22v-4"/></>,
  "code":          <><path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/></>,
  "ungroup":       <><rect x="3" y="3" width="8" height="6" rx="1"/><rect x="13" y="15" width="8" height="6" rx="1"/><path d="M11 6h4M9 9v4"/></>,
  "info":          <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
  "play":          <><polygon points="6 4 20 12 6 20 6 4"/></>,
  "save":          <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></>,
  "download":      <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></>,
  "upload":        <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/></>,
  "file":          <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/></>,
  "file-text":     <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></>,
  "copy":          <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  "trash":         <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
  "edit":          <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></>,
  "zoom-in":       <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></>,
  "zoom-out":      <><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M8 11h6"/></>,
  "maximize":      <><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></>,
  "grid":          <><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></>,
  "undo":          <><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></>,
  "redo":          <><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 15-6.7L21 13"/></>,
  "wand":          <><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M15 9h0M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5"/></>,
  "clipboard-list":<><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h.01M13 12h3M9 16h.01M13 16h3"/></>,
  "scan":          <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10"/></>,
  "dna":           <><path d="M2 15c4 0 4-4 8-4s4 4 8 4"/><path d="M2 9c4 0 4 4 8 4s4-4 8-4"/><path d="M4 22V2M20 22V2"/></>,
  "test-tube":     <><path d="M14.5 2v17.5a3 3 0 1 1-6 0V2"/><path d="M8 2h8M8 10h6"/></>,
  "microscope":    <><path d="M6 18h8M3 22h18M14 22a7 7 0 1 0-7-7"/><path d="M9 14h2M9 12a2 2 0 0 1-2-2V6h4v4a2 2 0 0 1-2 2ZM12 6H8M15 6v4"/></>,
  "flask-conical": <><path d="M10 2v7.5L4 21h16l-6-11.5V2"/><path d="M9 2h6M7 16h10"/></>,
  "droplets":      <><path d="M7 3a4 4 0 0 0 4 4v0a4 4 0 0 0-4-4Z"/><path d="M12.56 6.6A11 11 0 0 0 17 13.5a4 4 0 1 1-8 0c0-2.65 2-4.9 3.56-6.9Z"/></>,
  "stethoscope":   <><path d="M4.8 2.3A.3.3 0 1 0 5 2h-.4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-.4a.3.3 0 1 0 .2.3"/><path d="M8 15v2a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/></>,
  "heart-pulse":   <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8Z"/><path d="M3.2 12.3 8 12l2-5 3 9 2-4h5.4"/></>,
  "activity":      <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
  "arrow-right":   <><path d="M5 12h14M13 6l6 6-6 6"/></>,
  "filter":        <><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z"/></>,
  "more":          <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
  "lock":          <><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  "square":        <><rect x="3" y="3" width="18" height="18" rx="2"/></>,
  "circle":        <><circle cx="12" cy="12" r="10"/></>,
  "pointer":       <><path d="M5 3l8 16 2-7 7-2Z"/></>,
  "link":          <><path d="M10 13a5 5 0 0 0 7.1 0l3-3a5 5 0 1 0-7.1-7.1l-1 1"/><path d="M14 11a5 5 0 0 0-7.1 0l-3 3a5 5 0 1 0 7.1 7.1l1-1"/></>,
  "split":         <><path d="M16 3h5v5M4 20l16.2-16.2M21 16v5h-5M15 15l6 6M4 4l5 5"/></>,
  "merge":         <><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></>,
  "logo-tb":       <><path d="M4 4h16v16H4z"/></>,
  "minimize":      <><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/></>,
  "shield":        <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></>,
  "zap":           <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  "timer":         <><circle cx="12" cy="14" r="8"/><path d="M12 10v4l2 2M9 2h6"/></>,
  "user":          <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  "users":         <><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/><circle cx="8.5" cy="7" r="4"/></>,
  "bookmark":      <><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16Z"/></>,
  "sliders":       <><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>,
};
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
