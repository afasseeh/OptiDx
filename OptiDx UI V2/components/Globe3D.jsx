// Globe3D — Three.js globe with country pins and selection.
// Renders an Earth sphere with graticule, highlights selected country with a
// glowing pin, supports rotate/zoom/tilt, and auto-centers on selected country.

const { useEffect, useRef, useState } = React;

function latLngToVec3(lat, lng, r) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

function Globe3D({ countries, selectedCode, onSelect, theme = "day" }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    const mount = mountRef.current;
    const w = mount.clientWidth, h = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 1000);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(5, 3, 5);
    scene.add(sun);

    // Earth sphere — textured via built-in procedural canvas (offline, no network).
    const globeGroup = new THREE.Group();
    globeGroup.rotation.order = "YXZ"; // Y (longitude) first, then X (tilt)
    scene.add(globeGroup);

    const R = 2;
    const earthGeom = new THREE.SphereGeometry(R, 96, 96);

    // Build procedural earth texture using canvas + simple mena shapes
    const earthTex = makeEarthTexture(theme);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTex,
      shininess: theme === "night" ? 25 : 18,
      specular: theme === "night" ? 0x112030 : 0x223040
    });
    const earth = new THREE.Mesh(earthGeom, earthMat);
    globeGroup.add(earth);

    // Subtle cloud layer for realism
    const cloudTex = new THREE.TextureLoader().load(
      "https://unpkg.com/three-globe@2.31.1/example/img/earth-topology.png"
    );
    const cloudMat = new THREE.MeshPhongMaterial({
      map: cloudTex, transparent: true, opacity: theme === "night" ? 0.12 : 0.22,
      depthWrite: false
    });
    const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.008, 64, 64), cloudMat);
    globeGroup.add(clouds);

    // Atmosphere glow
    const atmGeom = new THREE.SphereGeometry(R * 1.06, 64, 64);
    const atmMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.BackSide,
      uniforms: { color: { value: new THREE.Color(theme === "night" ? 0xF37739 : 0x9bbad9) } },
      vertexShader: `
        varying vec3 vN;
        void main() { vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        uniform vec3 color; varying vec3 vN;
        void main() {
          float i = pow(0.75 - dot(vN, vec3(0,0,1)), 3.0);
          gl_FragColor = vec4(color, 1.0) * i;
        }`
    });
    const atm = new THREE.Mesh(atmGeom, atmMat);
    scene.add(atm);

    // Pins for countries
    const pinGroup = new THREE.Group();
    globeGroup.add(pinGroup);
    const pinObjects = {};

    countries.forEach(c => {
      const pos = latLngToVec3(c.lat, c.lng, R * 1.005);
      const pct = progressPct(c);
      const color = pinColor(pct);

      // Base dot
      const dotGeom = new THREE.SphereGeometry(0.045, 16, 16);
      const dotMat = new THREE.MeshBasicMaterial({ color });
      const dot = new THREE.Mesh(dotGeom, dotMat);
      dot.position.copy(pos);
      dot.userData.code = c.code;

      // Pin stem (extrusion = progress)
      const stemH = 0.08 + pct * 0.45;
      const stemGeom = new THREE.CylinderGeometry(0.015, 0.015, stemH, 8);
      const stemMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 });
      const stem = new THREE.Mesh(stemGeom, stemMat);
      // orient along surface normal
      const up = pos.clone().normalize();
      stem.position.copy(pos.clone().add(up.clone().multiplyScalar(stemH/2)));
      stem.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), up);

      // Halo ring (appears when selected)
      const ringGeom = new THREE.RingGeometry(0.08, 0.12, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xF37739, side: THREE.DoubleSide, transparent: true, opacity: 0 });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0,0,0));
      ring.rotateX(Math.PI);

      pinGroup.add(stem); pinGroup.add(dot); pinGroup.add(ring);
      pinObjects[c.code] = { dot, stem, ring, pos };
    });

    // Drag-to-rotate
    let isDown = false, lx = 0, ly = 0;
    let targetRotY = 0, targetRotX = 0;
    let curRotY = 0, curRotX = 0;
    let targetZoom = 7;
    // Default view: center on MENA region (~30N, 40E)
    // Default view: center on MENA (~30N, 40E).
    // latLngToVec3 with lat=0,lng=0 lands at +X axis (because theta = (lng+180)*PI/180 = PI,
    // so sin(theta)=0, cos(theta)=-1; x=-r*1*(-1)=+r, z=0). We want that point to face
    // the camera at +Z. With YXZ order: rotY brings a +X point to +Z via rotY = -PI/2.
    function aimAt(lat, lng) {
      // angle around Y needed to bring longitude `lng` to face +Z camera
      // at (lat=0, lng), vec is (-cos(theta), 0, sin(theta)) where theta=(lng+180)*PI/180
      // We want to rotate by rotY so that rotated point has x=0, z>0.
      // Simpler: target rotY = -lng*PI/180 - PI/2  (so lng=0 -> -PI/2 face +Z; lng=40 -> shift)
      const rotY = -(lng * Math.PI / 180) - Math.PI / 2;
      const rotX = lat * Math.PI / 180;
      return { rotX, rotY };
    }
    const mena = aimAt(28, 42);
    targetRotY = mena.rotY; targetRotX = mena.rotX;
    curRotY = targetRotY; curRotX = targetRotX;
    stateRef.current.aimAt = aimAt;

    const canvas = renderer.domElement;
    canvas.style.cursor = "grab";
    canvas.addEventListener("pointerdown", (e) => {
      isDown = true; lx = e.clientX; ly = e.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      targetRotY += dx * 0.005;
      targetRotX += dy * 0.005;
      targetRotX = Math.max(-1.2, Math.min(1.2, targetRotX));
      lx = e.clientX; ly = e.clientY;
    });
    const endDrag = (e) => { isDown = false; canvas.style.cursor = "grab"; };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      targetZoom = Math.max(3.2, Math.min(12, targetZoom + e.deltaY * 0.005));
    }, { passive: false });

    // Click to select
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    canvas.addEventListener("click", (e) => {
      const rect = canvas.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(Object.values(pinObjects).map(p => p.dot), false);
      if (hits.length) {
        const code = hits[0].object.userData.code;
        if (onSelect) onSelect(code);
      }
    });

    stateRef.current = Object.assign(stateRef.current || {}, {
      setTarget: (rotX, rotY, zoom) => {
        targetRotX = rotX; targetRotY = rotY;
        if (zoom != null) targetZoom = zoom;
      },
      setSelected: (code) => {
        Object.keys(pinObjects).forEach(k => {
          const p = pinObjects[k];
          p.ring.material.opacity = k === code ? 0.9 : 0;
          p.dot.scale.setScalar(k === code ? 1.7 : 1);
        });
      }
    });

    let t = 0;
    let raf;
    const animate = () => {
      t += 0.016;
      // Smooth rotation
      curRotY += (targetRotY - curRotY) * 0.12;
      curRotX += (targetRotX - curRotX) * 0.12;
      globeGroup.rotation.y = curRotY;
      globeGroup.rotation.x = curRotX;
      // Smooth zoom
      camera.position.z += (targetZoom - camera.position.z) * 0.1;
      // Ring pulsation on selected
      Object.values(pinObjects).forEach(p => {
        if (p.ring.material.opacity > 0.1) {
          const s = 1 + Math.sin(t * 3) * 0.15;
          p.ring.scale.set(s, s, s);
        }
      });
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      earthTex.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [theme]);

  // React to selection changes
  useEffect(() => {
    if (!stateRef.current.setSelected) return;
    stateRef.current.setSelected(selectedCode);
    if (selectedCode && stateRef.current.aimAt) {
      const c = countries.find(x => x.code === selectedCode);
      if (c) {
        const { rotX, rotY } = stateRef.current.aimAt(c.lat, c.lng);
        stateRef.current.setTarget(rotX, rotY, 4.2);
      }
    }
  }, [selectedCode]);

  return React.createElement("div", { ref: mountRef, className: "globe-mount" });
}

// ---- Helpers ----

function progressPct(c) {
  const vals = Object.values(c.status || {});
  if (!vals.length) return 0;
  const done = vals.filter(Boolean).length;
  return done / vals.length;
}

function pinColor(pct) {
  // orange gradient, brand-aligned
  if (pct >= 0.66) return 0xF37739;      // strong orange
  if (pct >= 0.33) return 0xF9C09A;      // mid
  if (pct > 0)     return 0xFCE0CC;      // light
  return 0xB0B5B9;                        // no progress = neutral
}

// Earth texture — uses NASA Blue Marble for both themes (it reads well on
// dark backgrounds too, where the city-lights texture looks like a void).
function makeEarthTexture(theme) {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin("anonymous");
  const url = "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg";
  const tex = loader.load(url, t => { t.anisotropy = 8; });
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

window.Globe3D = Globe3D;
window.progressPct = progressPct;
