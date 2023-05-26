/**
 * MediaSource 分段下载播放 
 */

class Demo {
  constructor() {
    this.video = document.querySelector('video');
    this.baseUrl = './demo_dashinit.mp4';
    this.mimeCodec = 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"';
    this.mediaSource = null;
    this.sourceBuffer = null;


    this.cacheSeconds = 2; // 提前2s下载
    this.totalLength = 0; // 视频总共大小
    this.segmentStart = 0; // rangeStart
    this.segmentSize = 1024 * 1024 * 1; // 分段大小

    this.init();
  }


  init = () => {
    this.initMediaSource();
  }

  initMediaSource = () => {
    if ('MediaSource' in window && MediaSource.isTypeSupported(this.mimeCodec)) {
      const mediaSource = new MediaSource();
      this.video.src = URL.createObjectURL(mediaSource);
      this.mediaSource = mediaSource;

      mediaSource.addEventListener('sourceopen', this.sourceOpen);
    } else {
      console.error('不支持MediaSource');
      this.commonVideo();
    }
  }

  // 不支持MediaSource，则降级普通的video
  commonVideo = () => {
    const source = document.createElement('source');
    source.type = 'video/mp4';
    source.src = this.baseUrl;

    this.video.appendChild(source);
  }

  // 支持mediasource的，开始拉取数据
  sourceOpen = async () => {
    const sourceBuffer = this.mediaSource.addSourceBuffer(this.mimeCodec);
    console.log('sourceBuffer', sourceBuffer);

    this.sourceBuffer = sourceBuffer;

    await this.initVideoLength();
    this.initVideo();
  }

  // 获取视频大小
  initVideoLength = async () => {
    const length = await this.fetchVideoLength();
    this.totalLength = length;
  }

  // 初始化视频
  initVideo = async () => {
    // 获取初始的视频播放数据
    const initRange = this.calculateRange();

    const initData = await this.fetchVideo(initRange);
    console.log('initData', initData);

    // 更新下载的当前片段，方便计算下一次拉取
    this.updateSegmentStart(initRange);
    this.sourceBuffer.appendBuffer(initData);

    this.sourceBuffer.addEventListener("updateend", this.updateFunct, false);
    // 在 SourceBuffer.appendBuffer() 或 SourceBuffer.remove() 结束后触发。这个事件在 update 后触发。
  }

  updateSegmentStart = (range) => {
    const rangeEnd = parseInt(range.split('-')[1]);
    this.segmentStart = rangeEnd + 1;
  }
  // appendBuffer 之后，判断video数据是否处于可播放状态，不可播放的时候继续拉取
  updateFunct = async () => {
    console.log('updateFunct', this.video.buffered.length)
    if (this.video.buffered.length) {
      // 视频开始能播放后，监听视频的timeupdate来决定是否继续请求数据
      this.sourceBuffer.removeEventListener("updateend", this.updateFunct);
      this.bindVideoEvent();
    } else {
      // 继续加载初始化数据，直到视频能够播放，才能触发timeupdate事件
      const initRange = this.calculateRange();
      const initData = await this.fetchVideo(initRange);
       // 更新下载的当前片段，方便计算下一次拉取
      this.updateSegmentStart(initRange);

      this.sourceBuffer.appendBuffer(initData);
    }
  }

  bindVideoEvent = () => {
    this.video.addEventListener("timeupdate", this.timeupdate, false);
  }

  timeupdate = async () => {
    if (this.totalLength && this.segmentStart >= this.totalLength) {
      // 已经所有数据请求完成
      this.video.removeEventListener("timeupdate", this.timeupdate, false);
    } else {
      // 判断当前视频播放时间是否不够了。如果不够了则继续请求分段数据
      const needFetch = this.isNeedFetch();
      if (needFetch) {
        const range = this.calculateRange();
        const data = await this.fetchVideo(range);
        this.updateSegmentStart(range);
        this.sourceBuffer.appendBuffer(data);
      }
    }
  }


  isNeedFetch = () => {
    // 当前是否需求请求分段数据了
    for (let i = 0; i < this.video.buffered.length; i++) {
      const bufferend = this.video.buffered.end(i);
      if (this.video.currentTime < bufferend && bufferend - this.video.currentTime >= this.cacheSeconds)
        return false
    }
    return true;
  }


  calculateRange = () => {
    // 计算出当前分段的range
    // return '0-1386';
    const rangeStart = this.segmentStart;
    const maxRange = this.segmentStart + this.segmentSize - 1;
    const rangeEnd = Math.min(maxRange, this.totalLength - 1);

    return `${rangeStart}-${rangeEnd}`;
  }

  fetchVideo = (range) => {

    const url = this.baseUrl;
    return new Promise((resolve, reject) => {
      console.log('fetchVideo', range)
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.setRequestHeader("Range", "bytes=" + range);
      xhr.responseType = 'arraybuffer';

      xhr.onload = function (e) {
        if (xhr.status === 200 || xhr.status === 206) {
          return resolve(xhr.response);
        }
        return reject(xhr);
      };

      xhr.onerror = function () {
        reject(xhr);
      };
      xhr.send();
    })
  }

  fetchVideoLength = () => {
    const url = this.baseUrl;
    return new Promise((resolve, reject) => {
      console.log('fetchVideoLength', url)
      const xhr = new XMLHttpRequest();
      xhr.open("get", url);
      xhr.onprogress = function (event) {
        if (!event.lengthComputable) {
          return reject(xhr);
        }
        xhr.abort();
        resolve(event.total);
      };
      xhr.onerror = function () {
        reject(xhr);
      };
      xhr.send();
    })
  }

}

const demo = new Demo();