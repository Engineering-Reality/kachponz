/**
 * Shared Tesseract 4D & Swarm Intelligence Background Module
 * Based on Three.js
 */

function initTesseractBackground(containerId, options = {}) {
    const defaultOptions = {
        showParticles: false,
        particleCount: 150,
        cameraZ: 30,
        scale: 5,
        dimmer: false, // For dashboard pages
    };

    const config = { ...defaultOptions, ...options };
    const container = document.getElementById(containerId);
    
    if (!container) {
        console.error(`Container #${containerId} not found for Tesseract Background.`);
        return null;
    }

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0118, config.dimmer ? 0.005 : 0.002);

    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = config.cameraZ;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Clear previous canvas if any
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Particle Swarm logic (if enabled)
    let particles = [];
    let particleGroup = new THREE.Group();
    if (config.showParticles) {
        scene.add(particleGroup);

        class Particle {
            constructor() {
                this.position = new THREE.Vector3(
                    (Math.random() - 0.5) * 100,
                    (Math.random() - 0.5) * 100,
                    (Math.random() - 0.5) * 100
                );
                this.velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2,
                    (Math.random() - 0.5) * 0.2
                );
                this.acceleration = new THREE.Vector3();
                this.maxSpeed = 0.5;
                this.maxForce = 0.02;
                
                // Colors matched to LlamaIndex theme (violet/purple/glow)
                const colors = [
                    new THREE.Color(0x7c3aed), // Violet 600
                    new THREE.Color(0xc084fc), // Glow
                    new THREE.Color(0xa78bfa)  // Violet 400
                ];
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.sprite = null;
            }

            flock(boids) {
                let separation = new THREE.Vector3();
                let alignment = new THREE.Vector3();
                let cohesion = new THREE.Vector3();
                let count = 0;

                for (let i = 0; i < boids.length; i++) {
                    const other = boids[i];
                    const d = this.position.distanceTo(other.position);

                    if (d > 0 && d < 10) {
                        let diff = new THREE.Vector3().subVectors(this.position, other.position);
                        diff.normalize();
                        diff.divideScalar(d);
                        separation.add(diff);

                        alignment.add(other.velocity);
                        cohesion.add(other.position);
                        count++;
                    }
                }

                if (count > 0) {
                    separation.divideScalar(count);
                    alignment.divideScalar(count);
                    cohesion.divideScalar(count);

                    if (separation.lengthSq() > 0) {
                        separation.normalize().multiplyScalar(this.maxSpeed).sub(this.velocity).clampLength(0, this.maxForce);
                    }
                    if (alignment.lengthSq() > 0) {
                        alignment.normalize().multiplyScalar(this.maxSpeed).sub(this.velocity).clampLength(0, this.maxForce);
                    }
                    
                    cohesion.sub(this.position);
                    if (cohesion.lengthSq() > 0) {
                        cohesion.normalize().multiplyScalar(this.maxSpeed).sub(this.velocity).clampLength(0, this.maxForce);
                    }

                    this.acceleration.add(separation.multiplyScalar(1.5));
                    this.acceleration.add(alignment.multiplyScalar(1.0));
                    this.acceleration.add(cohesion.multiplyScalar(1.0));
                }
            }

            update() {
                this.velocity.add(this.acceleration);
                this.velocity.clampLength(0, this.maxSpeed);
                this.position.add(this.velocity);
                this.acceleration.set(0, 0, 0);

                if (this.position.x > 50) this.position.x = -50;
                if (this.position.x < -50) this.position.x = 50;
                if (this.position.y > 50) this.position.y = -50;
                if (this.position.y < -50) this.position.y = 50;
                if (this.position.z > 50) this.position.z = -50;
                if (this.position.z < -50) this.position.z = 50;
            }
        }

        const createBinaryTexture = (digit, colorHex) => {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = 'rgba(255, 255, 255, 0)';
            ctx.fillRect(0, 0, 128, 128);

            ctx.shadowBlur = 20;
            ctx.shadowColor = colorHex;

            ctx.font = 'bold 80px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = colorHex;

            for (let i = 0; i < 3; i++) {
                ctx.fillText(digit, 64, 64);
            }

            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(digit, 64, 64);

            return new THREE.CanvasTexture(canvas);
        };

        const textures = {
            c1: { zero: createBinaryTexture('0', '#7c3aed'), one: createBinaryTexture('1', '#7c3aed') },
            c2: { zero: createBinaryTexture('0', '#c084fc'), one: createBinaryTexture('1', '#c084fc') },
            c3: { zero: createBinaryTexture('0', '#a78bfa'), one: createBinaryTexture('1', '#a78bfa') }
        };

        for (let i = 0; i < config.particleCount; i++) {
            const particle = new Particle();
            particles.push(particle);
            
            let texGroup = textures.c1;
            if (particle.color.getHex() === 0xc084fc) texGroup = textures.c2;
            else if (particle.color.getHex() === 0xa78bfa) texGroup = textures.c3;
            
            const isOne = Math.random() > 0.5;
            const texture = isOne ? texGroup.one : texGroup.zero;

            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                opacity: 0.9,
                blending: THREE.AdditiveBlending
            });

            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(1, 1, 1);
            sprite.position.copy(particle.position);
            particleGroup.add(sprite);
            particle.sprite = sprite;
        }
    }

    // TESSERACT: 4D Hypercube Nucleus
    const tesseractVertices4D = [
        [-1, -1, -1, -1], [1, -1, -1, -1], [1, 1, -1, -1], [-1, 1, -1, -1],
        [-1, -1, 1, -1], [1, -1, 1, -1], [1, 1, 1, -1], [-1, 1, 1, -1],
        [-1, -1, -1, 1], [1, -1, -1, 1], [1, 1, -1, 1], [-1, 1, -1, 1],
        [-1, -1, 1, 1], [1, -1, 1, 1], [1, 1, 1, 1], [-1, 1, 1, 1]
    ];

    const tesseractEdges = [
        [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
        [8, 9], [9, 10], [10, 11], [11, 8], [12, 13], [13, 14], [14, 15], [15, 12], [8, 12], [9, 13], [10, 14], [11, 15],
        [0, 8], [1, 9], [2, 10], [3, 11], [4, 12], [5, 13], [6, 14], [7, 15]
    ];

    const project4Dto3D = (point4D, distance = 3) => {
        const w = point4D[3];
        const pScale = distance / (distance - w);
        return new THREE.Vector3(
            point4D[0] * pScale * config.scale,
            point4D[1] * pScale * config.scale,
            point4D[2] * pScale * config.scale
        );
    };

    const rotate4D = (point, angleXY, angleXZ, angleXW, angleYZ, angleYW, angleZW) => {
        let [x, y, z, w] = point;
        let newX, newY, newZ, newW;

        newX = x * Math.cos(angleXY) - y * Math.sin(angleXY);
        newY = x * Math.sin(angleXY) + y * Math.cos(angleXY);
        x = newX; y = newY;

        newX = x * Math.cos(angleXZ) - z * Math.sin(angleXZ);
        newZ = x * Math.sin(angleXZ) + z * Math.cos(angleXZ);
        x = newX; z = newZ;

        newX = x * Math.cos(angleXW) - w * Math.sin(angleXW);
        newW = x * Math.sin(angleXW) + w * Math.cos(angleXW);
        x = newX; w = newW;

        newY = y * Math.cos(angleYZ) - z * Math.sin(angleYZ);
        newZ = y * Math.sin(angleYZ) + z * Math.cos(angleYZ);
        y = newY; z = newZ;

        newY = y * Math.cos(angleYW) - w * Math.sin(angleYW);
        newW = y * Math.sin(angleYW) + w * Math.cos(angleYW);
        y = newY; w = newW;

        newZ = z * Math.cos(angleZW) - w * Math.sin(angleZW);
        newW = z * Math.sin(angleZW) + w * Math.cos(angleZW);
        z = newZ; w = newW;

        return [x, y, z, w];
    };

    const tesseractGroup = new THREE.Group();
    const tesseractLines = [];
    
    // Set line opacity based on dimmer setting
    const lineOpacity = config.dimmer ? 0.15 : 0.4;
    const lineColor = config.dimmer ? 0xa78bfa : 0xc084fc; // Violet tones

    tesseractEdges.forEach(edge => {
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(6);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.LineBasicMaterial({
            color: lineColor,
            transparent: true,
            opacity: lineOpacity,
            linewidth: 1
        });

        const line = new THREE.Line(geometry, material);
        tesseractGroup.add(line);
        tesseractLines.push({ line, edge });
    });

    scene.add(tesseractGroup);

    // Nucleus
    let nucleus = null;
    if (config.showParticles) { // Usually true for index page where nucleus is needed
        const nucleusGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);
        const nucleusMat = new THREE.ShaderMaterial({
            uniforms: { time: { value: 0 } },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                void main() {
                    vUv = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                uniform float time;

                void main() {
                    // LlamaIndex purple gradient
                    vec3 col1 = vec3(0.486, 0.227, 0.929); // #7c3aed
                    vec3 col2 = vec3(0.753, 0.518, 0.988); // #c084fc
                    vec3 col3 = vec3(0.655, 0.545, 0.980); // #a78bfa

                    float mixX = smoothstep(-0.75, 0.75, vPosition.x);
                    float mixY = smoothstep(-0.75, 0.75, vPosition.y);
                    
                    vec3 horizMix = mix(col1, col2, mixX);
                    vec3 color = mix(col3, horizMix, mixY);

                    gl_FragColor = vec4(color, 0.9);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
        scene.add(nucleus);

        const coreLight = new THREE.PointLight(0x7c3aed, 2, 50);
        coreLight.position.set(0, 0, 0);
        scene.add(coreLight);
    }

    let angleXY = 0, angleXZ = 0, angleXW = 0;
    let angleYZ = 0, angleYW = 0, angleZW = 0;
    
    let mouseX = 0, mouseY = 0;
    document.addEventListener('mousemove', (event) => {
        mouseX = event.clientX / window.innerWidth - 0.5;
        mouseY = event.clientY / window.innerHeight - 0.5;
    });

    const animate = () => {
        requestAnimationFrame(animate);

        if (config.showParticles) {
            for (let i = 0; i < particles.length; i++) {
                particles[i].flock(particles);
                particles[i].update();
                if (particles[i].sprite) {
                    particles[i].sprite.position.copy(particles[i].position);
                }
            }
            particleGroup.rotation.y = -mouseX * 0.2;
            particleGroup.rotation.x = -mouseY * 0.2;
        }

        // Tesseract Rotation
        tesseractGroup.rotation.y = -mouseX * 0.1;
        tesseractGroup.rotation.x = -mouseY * 0.1;

        angleXY += 0.005;
        angleXZ += 0.003;
        angleXW += 0.007;
        angleYZ += 0.004;
        angleYW += 0.006;
        angleZW += 0.002;

        tesseractLines.forEach(({ line, edge }) => {
            const [startIdx, endIdx] = edge;
            const rotatedStart = rotate4D(tesseractVertices4D[startIdx], angleXY, angleXZ, angleXW, angleYZ, angleYW, angleZW);
            const rotatedEnd = rotate4D(tesseractVertices4D[endIdx], angleXY, angleXZ, angleXW, angleYZ, angleYW, angleZW);
            
            const start3D = project4Dto3D(rotatedStart);
            const end3D = project4Dto3D(rotatedEnd);
            
            const positions = line.geometry.attributes.position.array;
            positions[0] = start3D.x; positions[1] = start3D.y; positions[2] = start3D.z;
            positions[3] = end3D.x; positions[4] = end3D.y; positions[5] = end3D.z;
            line.geometry.attributes.position.needsUpdate = true;
        });

        if (nucleus) {
            nucleus.rotation.x += 0.01;
            nucleus.rotation.y += 0.015;
            nucleus.rotation.z += 0.005;
        }

        renderer.render(scene, camera);
    };

    animate();

    window.addEventListener('resize', () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
    });

    return {
        scene,
        camera,
        renderer
    };
}
