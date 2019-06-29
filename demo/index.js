const piCamera = require('pi-camera');
const { yolo, downloadModel } = require('../src')
const { createCanvas, loadImage } = require('canvas')
const canvas = createCanvas(416, 416)
const ctx = canvas.getContext('2d')
const Webcam = require('./webcam');
const webcam = new Webcam(canvas);
const path = require('path');
const SerialPort = require('serialport');
const port = new SerialPort('/dev/ttyAMA0', { baudRate: 9600 });

port.write('<Serial Working!>');

let model;

const myCamera = new piCamera({
  mode: 'photo',
  output: `${ __dirname }/test.jpg`,
  width: 640,
  height: 480,
  nopreview: true,
});

(async function main() {
  try {
    model = await downloadModel();
    run();
  } catch(e) {
    console.error(e);
  }
})();

function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  // Take a picture
  await myCamera.snap()

  // Load the picture
  const image = await loadImage(path.resolve(__dirname, './test.jpg'))

  // model is expecting 416x416 image
  ctx.drawImage(image, 0, 0, 416, 416)

  const inputImage = webcam.capture();
  const t0 = Date.now();
  const boxes = await yolo(inputImage, model);

  inputImage.dispose();

  const t1 = Date.now();
  console.log("YOLO inference took " + (t1 - t0) + " milliseconds.");

  // boxes.forEach(box => {
  //   const {
  //     classProb, className,
  //   } = box;
  //   console.log(`${className} Confidence: ${Math.round(classProb * 100)}%`)
  // });

  // Take boxes and return the # of persons.
  const personCount = boxes.filter(({className}) => className === 'person').length

  // Convert a number to a hexadecimal string with:
  const hex = (num) => {
    return num < 10 ? "0x0" + num.toString(16) : "0x" + num.toString(16);
  }

  // Send the number of people  to the arduino as a buffer of 3 bytes.
  // First byte lets the arduino know that this is a message it needs to parse.
  // Second byte is the number of people seen.
  // Third byte lets the arduino know that the message is ended.
  const buffer = new Buffer(3);
  buffer[0] = 0x3C;
  buffer[1] = hex(personCount);
  buffer[2] = 0x3E;
  port.write(buffer);
  console.log(buffer)

  await timeout(1000);
  await run();
}
