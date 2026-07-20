// Import map defined in HTML; use ES modules
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Global state
let scene, camera, renderer, controls, model;
let isTabVisible = true;
let isUserInteracting = false;
let lastWheelTime = 0;
let animationFrameId;

// DOM elements (will be set in init)
const canvas = document.getElementById('canvas3d');
const immersiveCanvas = document.getElementById('canvas3d-immersive');
const loadingOverlay = document.getElementById('loading-overlay');
const progressBar = document.getElementById('progress-bar');

// WebGL support check
function checkWebGL() {
    try {
        const testCanvas = document.createElement('canvas');
        const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
        return !!(gl && gl.getParameter);
    } catch (e) {
        return false;
    }
}

if (!checkWebGL()) {
    showError('Your browser does not support WebGL. Please use a modern browser.');
}

// Show error message in loading overlay
function showError(message) {
    if (loadingOverlay) {
        loadingOverlay.innerHTML = `
            <div class="loader-content">
                <p style="color: var(--accent-color); font-size: 1.2rem;">${message}</p>
                <p style="margin-top: 1rem; color: var(--text-secondary);">If loading from a file, try using a local server (e.g., python -m http.server).</p>
            </div>
        `;
    } else {
        alert(message);
    }
}

// Initialize function
function init() {
    if (!canvas) {
        console.error('Canvas not found');
        return;
    }

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);

    // Camera
    const aspect = canvas.clientWidth / canvas.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, 1, 5);

    // Renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting (will be implemented in Task 8)
    setupLights();

    // Controls (basic setup now, refined in Task 9)
    controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 2;
    controls.maxDistance = 10;
    // Auto-rotate when idle
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;

    // Track user interaction to pause auto-rotate
    isUserInteracting = false;
    lastWheelTime = 0;

    // When user clicks or touches, flag interaction
    canvas.addEventListener('mousedown', () => { isUserInteracting = true; });
    canvas.addEventListener('touchstart', () => { isUserInteracting = true; });

    // When mouse up or touch ends, clear flag after a short delay
    canvas.addEventListener('mouseup', () => {
        setTimeout(() => { isUserInteracting = false; }, 1000);
    });
    canvas.addEventListener('touchend', () => {
        setTimeout(() => { isUserInteracting = false; }, 1000);
    });

    // Wheel event: disable OrbitControls temporarily to allow page scroll
    canvas.addEventListener('wheel', (event) => {
        const now = Date.now();
        // Throttle to avoid excessive toggling
        if (now - lastWheelTime > 50) {
            controls.enabled = false;
            lastWheelTime = now;
            // Re-enable controls after a brief delay
            setTimeout(() => {
                if (!isUserInteracting) {
                    controls.enabled = true;
                }
            }, 100);
        }
    }, { passive: false });

    // Load model (implementation in Task 8)
    loadModel();

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    document.addEventListener('visibilitychange', onVisibilityChange);

    // Scroll animations
    setupScrollAnimations();
    onScroll(); // initial state
    window.addEventListener('scroll', onScroll);

    // Mobile navigation
    setupMobileNav();

    // Start animation loop
    animate();
}

// Placeholder functions to be implemented in later tasks
function setupLights() {
    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    // Hemisphere light (sky color, ground color, intensity)
    const hemisphere = new THREE.HemisphereLight(0x87CEEB, 0x362819, 0.5);
    scene.add(hemisphere);

    // Main directional light (key light) with shadows
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(5, 10, 7);
    directional.castShadow = true;
    directional.shadow.mapSize.width = 2048;
    directional.shadow.mapSize.height = 2048;
    scene.add(directional);

    // Rim light (back/side accent)
    const rim = new THREE.DirectionalLight(0x00C2FF, 0.5);
    rim.position.set(-5, 5, -5);
    scene.add(rim);
}

function loadModel() {
    const loader = new GLTFLoader();
    loader.load(
        'object.glb',
        (gltf) => {
            model = gltf.scene;

            // Enable shadows on all meshes
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Auto-center: compute bounding box and center at origin
            const box = new THREE.Box3().setFromObject(model);
            const center = box.getCenter(new THREE.Vector3());
            model.position.sub(center); // subtract center to center the model

            // Auto-scale: compute size and scale to fit (increase size for larger model)
            const size = box.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const scale = 4.5 / maxDim; // increased from 3 to 4.5 for larger model
            model.scale.setScalar(scale);

            scene.add(model);

            // Hide loading overlay
            if (loadingOverlay) {
                loadingOverlay.classList.add('hidden');
            }
        },
        (progress) => {
            if (progress.lengthComputable && progressBar) {
                const percent = (progress.loaded / progress.total) * 100;
                progressBar.style.width = percent + '%';
            }
        },
        (error) => {
            console.error('Model load error:', error);
            showError('Unable to load 3D model.');
        }
    );
}

function onWindowResize() {
    if (!camera || !renderer || !canvas) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function onVisibilityChange() {
    isTabVisible = !document.hidden;
}

function animate() {
    animationFrameId = requestAnimationFrame(animate);

    if (!isTabVisible) return;

    if (controls) controls.update();
    if (controls.enabled && !isUserInteracting && model) {
        controls.autoRotate = true;
    } else if (isUserInteracting) {
        controls.autoRotate = false;
    }
    renderer.render(scene, camera);
}

// Scroll animation setup
function setupScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('in-view');
            }
        });
    }, observerOptions);

    document.querySelectorAll('.animate-on-scroll').forEach((el) => {
        observer.observe(el);
    });
}

// Mobile navigation
function setupMobileNav() {
    const toggle = document.querySelector('.nav-toggle');
    const menu = document.querySelector('.nav-menu');

    if (!toggle || !menu) return;

    toggle.addEventListener('click', () => {
        const isOpen = menu.classList.toggle('open');
        toggle.setAttribute('aria-expanded', isOpen);
    });

    // Close menu when a nav link is clicked
    menu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.remove('open');
            toggle.setAttribute('aria-expanded', 'false');
        });
    });
}

function onScroll() {
    const scrollY = window.scrollY;
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    const scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;

    // Hero fade out
    const hero = document.querySelector('.hero');
    if (hero) {
        if (scrollY > 100) {
            hero.classList.add('fade-out');
        } else {
            hero.classList.remove('fade-out');
        }
    }

    // Update nav active link
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');
    let current = '';

    sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        if (scrollY >= sectionTop) {
            current = section.getAttribute('id');
        }
    });

    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === `#${current}`) {
            link.classList.add('active');
        }
    });

    // Subtle model rotation based on scroll
    if (model) {
        model.rotation.y = scrollProgress * Math.PI * 0.5; // 0 to 180 degrees over full page
    }
}

// Init when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
