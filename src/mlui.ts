import DeviceDetector from 'device-detector-js';

import controls from '@mediapipe/control_utils';
import drawingUtils from '@mediapipe/drawing_utils';
import {
  FACEMESH_FACE_OVAL,
  FACEMESH_LEFT_EYE,
  FACEMESH_LEFT_EYEBROW,
  FACEMESH_LIPS,
  FACEMESH_RIGHT_EYE,
  FACEMESH_RIGHT_EYEBROW,
  FACEMESH_TESSELATION,
  HAND_CONNECTIONS,
  Holistic,
  NormalizedLandmark,
  NormalizedLandmarkList,
  Options,
  POSE_CONNECTIONS,
  POSE_LANDMARKS,
  POSE_LANDMARKS_LEFT,
  POSE_LANDMARKS_RIGHT,
  Results,
} from '@mediapipe/holistic';

// Usage: testSupport({client?: string, os?: string}[])
// Client and os are regular expressions.
// See: https://cdn.jsdelivr.net/npm/device-detector-js@2.2.10/README.md for
// legal values for client and os
testSupport([{ client: "Chrome" }]);

function testSupport(supportedDevices: { client?: string; os?: string }[]) {
  const deviceDetector = new DeviceDetector();
  const detectedDevice = deviceDetector.parse(navigator.userAgent);

  let isSupported = false;
  for (const device of supportedDevices) {
    if (device.client !== undefined) {
      const re = new RegExp(`^${device.client}$`);
      if (!re.test(detectedDevice.client?.name ?? "")) {
        continue;
      }
    }
    if (device.os !== undefined) {
      const re = new RegExp(`^${device.os}$`);
      if (!re.test(detectedDevice.os?.name ?? "")) {
        continue;
      }
    }
    isSupported = true;
    break;
  }
  if (!isSupported) {
    alert(
      `This demo, running on ${detectedDevice.client?.name}/${detectedDevice.os?.name}, ` +
        `is not well supported at this time, continue at your own risk.`
    );
  }
}

// const controls = window;
// const drawingUtils = window;

// Our input frames will come from here.
const videoElement = document.getElementsByClassName(
  "input_video"
)[0] as HTMLVideoElement;
const canvasElement = document.getElementsByClassName(
  "output_canvas"
)[0] as HTMLCanvasElement;
const controlsElement = document.getElementsByClassName(
  "control-panel"
)[0] as HTMLDivElement;
const canvasCtx = canvasElement.getContext("2d")!;

// We'll add this to our control panel later, but we'll save it here so we can
// call tick() each time the graph runs.
const fpsControl = new controls.FPS();

// Optimization: Turn off animated spinner after its hiding animation is done.
const spinner = document.querySelector(".loading")! as HTMLDivElement;
spinner.ontransitionend = () => {
  spinner.style.display = "none";
};

function removeElements(landmarks: NormalizedLandmarkList, elements: number[]) {
  for (const element of elements) {
    delete landmarks[element];
  }
}

function removeLandmarks(results: Results) {
  if (results.poseLandmarks) {
    removeElements(
      results.poseLandmarks,
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20, 21, 22]
    );
  }
}

function connect(
  ctx: CanvasRenderingContext2D,
  connectors: Array<[NormalizedLandmark, NormalizedLandmark]>
): void {
  const canvas = ctx.canvas;
  for (const connector of connectors) {
    const from = connector[0];
    const to = connector[1];
    if (from && to) {
      if (
        from.visibility &&
        to.visibility &&
        (from.visibility < 0.1 || to.visibility < 0.1)
      ) {
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(from.x * canvas.width, from.y * canvas.height);
      ctx.lineTo(to.x * canvas.width, to.y * canvas.height);
      ctx.stroke();
    }
  }
}

function onResults(results: Results): void {
  // Hide the spinner.
  document.body.classList.add("loaded");

  // Remove landmarks we don't want to draw.
  removeLandmarks(results);

  // Update the frame rate.
  fpsControl.tick();

  // Draw the overlays.
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  // Connect elbows to hands. Do this first so that the other graphics will draw
  // on top of these marks.
  canvasCtx.lineWidth = 5;
  if (results.poseLandmarks) {
    if (results.rightHandLandmarks) {
      canvasCtx.strokeStyle = "white";
      connect(canvasCtx, [
        [
          results.poseLandmarks[POSE_LANDMARKS.RIGHT_ELBOW],
          results.rightHandLandmarks[0],
        ],
      ]);
    }
    if (results.leftHandLandmarks) {
      canvasCtx.strokeStyle = "white";
      connect(canvasCtx, [
        [
          results.poseLandmarks[POSE_LANDMARKS.LEFT_ELBOW],
          results.leftHandLandmarks[0],
        ],
      ]);
    }
  }

  // Pose...
  drawingUtils.drawConnectors(
    canvasCtx,
    results.poseLandmarks,
    POSE_CONNECTIONS,
    { color: "white" }
  );
  drawingUtils.drawLandmarks(
    canvasCtx,
    Object.values(POSE_LANDMARKS_LEFT).map(
      (index) => results.poseLandmarks[index]
    ),
    { visibilityMin: 0.65, color: "white", fillColor: "rgb(255,138,0)" }
  );
  drawingUtils.drawLandmarks(
    canvasCtx,
    Object.values(POSE_LANDMARKS_RIGHT).map(
      (index) => results.poseLandmarks[index]
    ),
    { visibilityMin: 0.65, color: "white", fillColor: "rgb(0,217,231)" }
  );

  // Hands...
  drawingUtils.drawConnectors(
    canvasCtx,
    results.rightHandLandmarks,
    HAND_CONNECTIONS,
    { color: "white" }
  );
  drawingUtils.drawLandmarks(canvasCtx, results.rightHandLandmarks, {
    color: "white",
    fillColor: "rgb(0,217,231)",
    lineWidth: 2,
    radius: (data: drawingUtils.Data) => {
      return drawingUtils.lerp(data.from!.z!, -0.15, 0.1, 10, 1);
    },
  });
  drawingUtils.drawConnectors(
    canvasCtx,
    results.leftHandLandmarks,
    HAND_CONNECTIONS,
    { color: "white" }
  );
  drawingUtils.drawLandmarks(canvasCtx, results.leftHandLandmarks, {
    color: "white",
    fillColor: "rgb(255,138,0)",
    lineWidth: 2,
    radius: (data: drawingUtils.Data) => {
      return drawingUtils.lerp(data.from!.z!, -0.15, 0.1, 10, 1);
    },
  });

  // Face...
  drawingUtils.drawConnectors(
    canvasCtx,
    results.faceLandmarks,
    FACEMESH_TESSELATION,
    { color: "#C0C0C070", lineWidth: 1 }
  );
  drawingUtils.drawConnectors(
    canvasCtx,
    results.faceLandmarks,
    FACEMESH_RIGHT_EYE,
    { color: "rgb(0,217,231)" }
  );
  drawingUtils.drawConnectors(
    canvasCtx,
    results.faceLandmarks,
    FACEMESH_RIGHT_EYEBROW,
    { color: "rgb(0,217,231)" }
  );
  drawingUtils.drawConnectors(
    canvasCtx,
    results.faceLandmarks,
    FACEMESH_LEFT_EYE,
    { color: "rgb(255,138,0)" }
  );
  drawingUtils.drawConnectors(
    canvasCtx,
    results.faceLandmarks,
    FACEMESH_LEFT_EYEBROW,
    { color: "rgb(255,138,0)" }
  );
  drawingUtils.drawConnectors(
    canvasCtx,
    results.faceLandmarks,
    FACEMESH_FACE_OVAL,
    { color: "#E0E0E0", lineWidth: 5 }
  );
  drawingUtils.drawConnectors(canvasCtx, results.faceLandmarks, FACEMESH_LIPS, {
    color: "#E0E0E0",
    lineWidth: 5,
  });

  canvasCtx.restore();
}

const holistic = new Holistic({
  locateFile: (file) => {
    return `/holistic/${file}`;
  },
});
holistic.onResults(onResults);

// Present a control panel through which the user can manipulate the solution
// options.
new controls.ControlPanel(controlsElement, {
  selfieMode: true,
  modelComplexity: 1,
  smoothLandmarks: true,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
})
  .add([
    new controls.StaticText({ title: "MediaPipe Holistic" }),
    fpsControl,
    new controls.Toggle({ title: "Selfie Mode", field: "selfieMode" }),
    new controls.SourcePicker({
      onSourceChanged: () => {
        holistic.reset();
      },
      onFrame: async (input: controls.InputImage, size: controls.Rectangle) => {
        const aspect = size.height / size.width;
        let width: number, height: number;
        if (window.innerWidth > window.innerHeight) {
          height = window.innerHeight;
          width = height / aspect;
        } else {
          width = window.innerWidth;
          height = width * aspect;
        }
        canvasElement.width = width;
        canvasElement.height = height;
        await holistic.send({ image: input });
      },
      examples: {
        videos: [],
        images: [],
      },
    }),
    new controls.Slider({
      title: "Model Complexity",
      field: "modelComplexity",
      discrete: ["Lite", "Full", "Heavy"],
    }),
    new controls.Toggle({
      title: "Smooth Landmarks",
      field: "smoothLandmarks",
    }),
    new controls.Slider({
      title: "Min Detection Confidence",
      field: "minDetectionConfidence",
      range: [0, 1],
      step: 0.01,
    }),
    new controls.Slider({
      title: "Min Tracking Confidence",
      field: "minTrackingConfidence",
      range: [0, 1],
      step: 0.01,
    }),
  ])
  .on((x) => {
    const options = x as Options;
    videoElement.classList.toggle("selfie", options.selfieMode);
    holistic.setOptions(options);
  });
