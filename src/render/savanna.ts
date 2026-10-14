import {
  BackSide,
  Color,
  ConeGeometry,
  DirectionalLight,
  Fog,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  RingGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
} from 'three';

const SKY_TOP = new Color('#4f9be0');
const SKY_MID = new Color('#a9d4f2');
const HORIZON = new Color('#f3dcae');
const GROUND = new Color('#d4a95f');
const TRACK = new Color('#b98a4a');
const GRASS = new Color('#a8923f');

/** Savannscen: mark, himmel, dimma och ljus. Radien är cirkelbanans radie. */
export function createSavanna(trackRadius: number): Scene {
  const scene = new Scene();
  scene.fog = new Fog(HORIZON, 30, 140);

  scene.add(createSky());
  scene.add(createGround());
  scene.add(createTrack(trackRadius));
  scene.add(createGrass(trackRadius));

  scene.add(new HemisphereLight('#cfe8ff', '#b08850', 1.4));

  const sun = new DirectionalLight('#fff1d6', 2.6);
  sun.position.set(8, 14, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  // Skuggkameran täcker bara cirkeln + marginal, så att 1024 px räcker.
  const extent = trackRadius + 3;
  sun.shadow.camera.left = -extent;
  sun.shadow.camera.right = extent;
  sun.shadow.camera.top = extent;
  sun.shadow.camera.bottom = -extent;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.add(sun.target);

  return scene;
}

function createSky(): Mesh {
  const material = new ShaderMaterial({
    uniforms: {
      uTop: { value: SKY_TOP },
      uMid: { value: SKY_MID },
      uHorizon: { value: HORIZON },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uMid;
      uniform vec3 uHorizon;
      varying vec3 vDir;
      void main() {
        float y = max(vDir.y, 0.0);
        vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.12, y));
        c = mix(c, uTop, smoothstep(0.12, 0.6, y));
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new Mesh(new SphereGeometry(200, 24, 12), material);
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}

function createGround(): Mesh {
  const ground = new Mesh(new PlaneGeometry(400, 400), new MeshLambertMaterial({ color: GROUND }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  return ground;
}

/** Upptrampad stig där zebran springer – ger rörelsekänsla mot marken. */
function createTrack(radius: number): Mesh {
  const track = new Mesh(
    new RingGeometry(radius - 0.8, radius + 0.8, 64),
    new MeshLambertMaterial({ color: TRACK }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.y = 0.005;
  track.receiveShadow = true;
  return track;
}

/** Grästuvor som en enda instansierad mesh (ett ritanrop). */
function createGrass(trackRadius: number): InstancedMesh {
  const count = 90;
  const grass = new InstancedMesh(
    new ConeGeometry(0.22, 0.35, 5),
    new MeshLambertMaterial({ color: GRASS }),
    count,
  );
  const m = new Matrix4();
  let seed = 7;
  const rand = (): number => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    // Undvik stigen så att zebran inte springer genom tuvorna.
    let r = 1 + rand() * 30;
    if (Math.abs(r - trackRadius) < 1.4) r += 3;
    const a = rand() * Math.PI * 2;
    const s = 0.6 + rand() * 0.9;
    m.makeScale(s, s * (0.7 + rand() * 0.8), s);
    m.setPosition(Math.cos(a) * r, 0.17 * s, Math.sin(a) * r);
    grass.setMatrixAt(i, m);
  }
  grass.castShadow = true;
  return grass;
}
