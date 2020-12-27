<script>
  import * as tfjs from '@tensorflow/tfjs'
  import * as posenet from '@tensorflow-models/posenet'
  import { Message } from 'svelma'
  import Stats from 'stats.js'
  import { db } from './firebase'
  import { user } from './stores'

  const stats = new Stats()
  const contentWidth = 800
  const contentHeight = 600
  const maxRecentPosesLength = 25
  let recentPoses = []
  let lastStatus = 'resting'
  // const NOSE = 0
  // const LEFT_EYE = 1
  // const RIGHT_EYE = 2
  // const LEFT_EAR = 3
  // const RIGHT_EAR = 4
  const LEFT_SHOULDER = 5
  const RIGHT_SHOULDER = 6
  // const LEFT_ELBOW = 7
  // const RIGHT_ELBOW = 8
  const LEFT_WRIST = 9
  const RIGHT_WRIST = 10
  // const LEFT_HIP = 11
  // const RIGHT_HIP = 12
  const LEFT_KNEE = 13
  const RIGHT_KNEE = 14
  // const LEFT_ANKLE = 15
  // const RIGHT_ANKLE = 16
  const usedPoints = [
    LEFT_SHOULDER,
    RIGHT_SHOULDER,
    LEFT_WRIST,
    RIGHT_WRIST,
    LEFT_KNEE,
    RIGHT_KNEE,
  ]

  const OK_MESSAGE = '体が正しく画角に収まっています'
  const TOO_FAR_MESSAGE = 'もう少しカメラに近づいてください'
  const NOT_CLEAR_MESSAGE = '肩、手首、膝をしっかり映してください'
  let cameraMessage = '判定中です'

  const bindPage = async () => {
    const net = await posenet.load()
    let video
    try {
      video = await loadVideo()
    } catch (e) {
      console.error(e)
      return
    }
    detectPoseInRealTime(video, net)
  }

  bindPage()

  const loadVideo = async () => {
    const video = await setupCamera()
    video.play()
    return video
  }

  const setupCamera = async () => {
    const video = document.getElementById('video')
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: true,
      })
      video.srcObject = stream

      return new Promise((resolve) => {
        video.onloadedmetadata = () => {
          resolve(video)
        }
      })
    } else {
      const errorMessage =
        'This browser does not support video capture, or this device does not have a camera'
      alert(errorMessage)
      return Promise.reject(errorMessage)
    }
  }

  const detectPoseInRealTime = (video, net) => {
    const canvas = document.getElementById('canvas')
    const ctx = canvas.getContext('2d')
    const flipHorizontal = true
    const docRef = db.collection('conditions').doc($user.uid)

    const poseDetectionFrame = async () => {
      stats.begin()
      let poses = []
      const pose = await net.estimateSinglePose(video, {
        flipHorizontal,
      })
      poses.push(pose)

      ctx.clearRect(0, 0, contentWidth, contentHeight)

      ctx.save()
      ctx.scale(-1, 1)
      ctx.translate(-contentWidth, 0)
      ctx.drawImage(video, 0, 0, contentWidth, contentHeight)
      ctx.restore()

      poses.forEach(({ score, keypoints }) => {
        if (score >= 0.5 && isUsedPointsClear(keypoints)) {
          if (cameraMessage != TOO_FAR_MESSAGE && isTooFar(keypoints)) {
            cameraMessage = TOO_FAR_MESSAGE
          }
          cameraMessage = OK_MESSAGE
          drawKeypoints(keypoints, 0.1, ctx)
          drawSkeleton(keypoints, 0.1, ctx)
          recentPoses = updateRecentPoses(recentPoses, keypoints)
          const status = estimateStatus(recentPoses)
          if (status !== lastStatus) {
            lastStatus = status
            console.log(status)
            docRef.set({ status })
          }
        } else {
          if (cameraMessage != NOT_CLEAR_MESSAGE) {
            cameraMessage = NOT_CLEAR_MESSAGE
          }
          docRef.set({ status: 'resting' })
        }
      })

      stats.end()

      requestAnimationFrame(poseDetectionFrame)
    }
    poseDetectionFrame()
  }

  const isUsedPointsClear = (keypoints) =>
    usedPoints.every((point) => keypoints[point].score >= 0.5)
  
  const isTooFar = (keypoints) =>
    keypoints[LEFT_KNEE] - keypoints[LEFT_SHOULDER] <= 200

  const toTuple = ({ y, x }) => {
    return [y, x]
  }

  const drawPoint = (ctx, y, x, r, color) => {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, 2 * Math.PI)
    ctx.fillStyle = color
    ctx.fill()
  }

  const drawSegment = ([ay, ax], [by, bx], color, scale, ctx) => {
    ctx.beginPath()
    ctx.moveTo(ax * scale, ay * scale)
    ctx.lineTo(bx * scale, by * scale)
    ctx.lineWidth = 0.5
    ctx.strokeStyle = color
    ctx.stroke()
  }

  const drawSkeleton = (keypoints, minConfidence = 0.1, ctx, scale = 1) => {
    const adjacentKeyPoints = posenet.getAdjacentKeyPoints(
      keypoints,
      minConfidence,
    )

    adjacentKeyPoints.forEach((keypoints) => {
      drawSegment(
        toTuple(keypoints[0].position),
        toTuple(keypoints[1].position),
        'red',
        scale,
        ctx,
      )
    })
  }

  const drawKeypoints = (keypoints, minConfidence = 0.1, ctx, scale = 1) => {
    for (let i = 0; i < keypoints.length; i++) {
      const keypoint = keypoints[i]

      if (keypoint.score < minConfidence) {
        continue
      }

      const { y, x } = keypoint.position
      drawPoint(ctx, y * scale, x * scale, 3, 'red')
    }
  }

  const estimateStatus = (recentPoses) => {
    if (isTurningRight(recentPoses)) return 'turningRight'
    if (isTurningLeft(recentPoses)) return 'turningLeft'
    if (isWalking(recentPoses)) return 'walking'
    return 'resting'
  }

  const updateRecentPoses = (recentPoses, keypoints) => {
    let result = recentPoses.slice()
    if (result.length >= maxRecentPosesLength) {
      result.splice(0, 1)
    }
    if (isRightStepping(keypoints)) {
      result.push('rightStep')
      return result
    }
    if (isLeftStepping(keypoints)) {
      result.push('leftStep')
      return result
    }
    if (isRasingRightHand(keypoints)) {
      result.push('rightHandUp')
      return result
    }
    if (isRasingLeftHand(keypoints)) {
      result.push('leftHandUp')
      return result
    }
    result.push('other')
    return result
  }

  const isWalking = (recentPoses) =>
    recentPoses.filter((pose) => pose === 'rightStep').length >= 2 &&
    recentPoses.filter((pose) => pose === 'leftStep').length >= 2

  const isTurningRight = (recentPoses) =>
    recentPoses.filter((pose) => pose === 'rightHandUp').length >= 5

  const isTurningLeft = (recentPoses) =>
    recentPoses.filter((pose) => pose === 'leftHandUp').length >= 5

  // 左手首が右手首よりも上、右膝が左膝よりも上なら右ステップとして判定
  const isRightStepping = (keypoints) =>
    keypoints[LEFT_WRIST].position.y < keypoints[RIGHT_WRIST].position.y - 2 &&
    keypoints[RIGHT_KNEE].position.y < keypoints[LEFT_KNEE].position.y - 2

  // 右手首が左手首よりも上、左膝が右膝よりも上なら右ステップとして判定
  const isLeftStepping = (keypoints) =>
    keypoints[RIGHT_WRIST].position.y < keypoints[LEFT_WRIST].position.y - 2 &&
    keypoints[LEFT_KNEE].position.y < keypoints[RIGHT_KNEE].position.y - 2

  // 右手首が右肩よりも上にあれば右手を挙げていると判定
  const isRasingRightHand = (keypoints) =>
    keypoints[RIGHT_SHOULDER].position.y - 5 > keypoints[RIGHT_WRIST].position.y

  // 左手首が左肩よりも上にあれば左手を挙げていると判定
  const isRasingLeftHand = (keypoints) =>
    keypoints[LEFT_SHOULDER].position.y - 5 > keypoints[LEFT_WRIST].position.y
</script>

<div style="padding: 0 30px;">
  {#if cameraMessage === OK_MESSAGE}
    <Message type='is-success' showClose={false} size="45px">
      {cameraMessage}
    </Message>
  {:else}
    <Message type='is-warning' showClose={false} size="45px">
      {cameraMessage}
    </Message>
  {/if}
  <!-- svelte-ignore a11y-media-has-caption -->
  <video
    id="video"
    width="800px"
    height="600px"
    autoplay="1"
    style="position:absolute;" />
  <canvas id="canvas" width="800px" height="600px" style="position:absolute;" />
</div>
