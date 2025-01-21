<template>
  <div id="root">
    <header>
      <Publicity v-show="!running" />
      <el-button class="res" type="text" @click="showResult = true">
        抽奖结果
      </el-button>
      <el-button class="con" type="text" @click="showConfig = true">
        抽奖配置
      </el-button>
    </header>
    <div id="main" :class="{ mask: showRes }"></div>
    <div id="tags">
      <ul v-for="item in datas" :key="item.key">
        <li>
          <a
            href="javascript:void(0);"
            :style="{
              color: '#fff',
            }"
          >
            {{ item.name ? item.name : item.key }}
            <img v-if="item.photo" :src="item.photo" :width="50" :height="50" />
          </a>
        </li>
      </ul>
    </div>
    <transition name="bounce">
  <div id="resbox" v-show="showRes">
    <p @click="showRes = false">{{ categoryName }}抽奖结果：</p>
    <div class="container">
      <span
        v-for="item in resArr"
        :key="item"
        class="itemres"
        :style="resCardStyle"
        :data-id="item"
        @click="showRes = false"
      >
        <!-- 如果有照片 -->
        <div class="cont" v-if="photos.find((d) => d.id === item)">
          <img
            :src="photos.find((d) => d.id === item).value"
            alt="photo"
            :width="160"
            :height="160"
          />
          <span>{{ item }}</span> <!-- 显示编号 -->
          <span v-if="list.find((d) => d.key === item)">
            {{ list.find((d) => d.key === item).name }}
          </span> <!-- 显示姓名 -->
        </div>

        <!-- 如果没有照片 -->
        <span class="cont" v-else>
          <span
            v-if="!!list.find((d) => d.key === item)"
            :style="{
              fontSize: '40px',
            }"
          >
            {{ list.find((d) => d.key === item).name }}
          </span>
          <span v-else>
            {{ item }}
          </span>
        </span>
      </span>
    </div>
  </div>
</transition>


    <el-button
      class="audio"
      type="text"
      @click="
        () => {
          playAudio(!audioPlaying);
        }
      "
    >
      <i
        class="iconfont"
        :class="[audioPlaying ? 'iconstop' : 'iconplay1']"
      ></i>
    </el-button>

    <LotteryConfig :visible.sync="showConfig" @resetconfig="reloadTagCanvas" />
    <Tool
      @toggle="toggle"
      @resetConfig="reloadTagCanvas"
      @getPhoto="getPhoto"
      :running="running"
      :closeRes="closeRes"
    />
    <Result :visible.sync="showResult"></Result>

    <span class="copy-right">
      英荔 AI 不止编程
    </span>

    <audio
      id="audiobg"
      preload="auto"
      controls
      autoplay
      loop
      @play="playHandler"
      @pause="pauseHandler"
    >
      <source :src="audioSrc" />
      你的浏览器不支持audio标签
    </audio>
  </div>
</template>
<script>
import LotteryConfig from '@/components/LotteryConfig';
import Publicity from '@/components/Publicity';
import Tool from '@/components/Tool';
import bgaudio from '@/assets/bg.mp3';
import beginaudio from '@/assets/begin.mp3';
import {
  getData,
  configField,
  resultField,
  newLotteryField,
  conversionCategoryName,
  listField,
} from '@/helper/index';
import { luckydrawHandler } from '@/helper/algorithm';
import Result from '@/components/Result';
import { database, DB_STORE_NAME } from '@/helper/db';
export default {
  name: 'App',

  components: { LotteryConfig, Publicity, Tool, Result },

  computed: {
    resCardStyle() {
      const style = { fontSize: '30px' };
      const { number } = this.config;
      if (number < 100) {
        style.fontSize = '100px';
      } else if (number < 1000) {
        style.fontSize = '80px';
      } else if (number < 10000) {
        style.fontSize = '60px';
      }
      return style;
    },
    config: {
      get() {
        return this.$store.state.config;
      },
    },
    result: {
      get() {
        return this.$store.state.result;
      },
      set(val) {
        this.$store.commit('setResult', val);
      },
    },
    list() {
      return this.$store.state.list;
    },
    allresult() {
      let allresult = [];
      for (const key in this.result) {
        if (this.result.hasOwnProperty(key)) {
          const element = this.result[key];
          allresult = allresult.concat(element);
       }
      }
      // 使用 Set 去重
      return Array.from(new Set(allresult));
    },
    datas() {
      const { number } = this.config;
      const nums = number >= 1500 ? 500 : this.config.number;
      const configNum = number > 1500 ? Math.floor(number / 3) : number;
      const randomShowNums = luckydrawHandler(configNum, [], nums);
      const randomShowDatas = randomShowNums.map((item) => {
        const listData = this.list.find((d) => d.key === item);
        const photo = this.photos.find((d) => d.id === item);
        return {
          key: item * (number > 1500 ? 3 : 1),
          name: listData ? listData.name : '',
          photo: photo ? photo.value : '',
        };
      });
      return randomShowDatas;
    },
    categoryName() {
      return conversionCategoryName(this.category);
    },
    photos() {
      return this.$store.state.photos;
    },
  },
  created() {
    const data = getData(configField);
    if (data) {
      this.$store.commit('setConfig', Object.assign({}, data));
    }
    const result = getData(resultField);
    if (result) {
      this.$store.commit('setResult', result);
    }

    const newLottery = getData(newLotteryField);
    if (newLottery) {
      const config = this.config;
      newLottery.forEach((item) => {
        this.$store.commit('setNewLottery', item);
        if (!config[item.key]) {
          this.$set(config, item.key, 0);
        }
      });
      this.$store.commit('setConfig', config);
    }

    const list = getData(listField);
    if (list) {
      this.$store.commit('setList', list);
    }
  },

  data() {
    return {
      running: false,
      showRes: false,
      showConfig: false,
      showResult: false,
      resArr: [],
      category: '',
      audioPlaying: false,
      audioSrc: bgaudio,
    };
  },
  watch: {
    photos: {
      deep: true,
      handler() {
        this.$nextTick(() => {
          this.reloadTagCanvas();
        });
      },
    },
  },
  mounted() {
    this.startTagCanvas();
    setTimeout(() => {
      this.getPhoto();
    }, 1000);
    window.addEventListener('resize', this.reportWindowSize);
    window.addEventListener("message", this.handleIframeMessage);
  },
  beforeDestroy() {
    window.removeEventListener('resize', this.reportWindowSize);
    window.removeEventListener("message", this.handleIframeMessage);
  },
  methods: {
    reportWindowSize() {
      const AppCanvas = this.$el.querySelector('#rootcanvas');
      if (AppCanvas.parentElement) {
        AppCanvas.parentElement.removeChild(AppCanvas);
      }
      this.startTagCanvas();
    },
    playHandler() {
      this.audioPlaying = true;
      this.$el.querySelector("#audiobg").play();
    },
    pauseHandler() {
      this.audioPlaying = false;
      this.$el.querySelector("#audiobg").pause();
    },
    handleIframeMessage(event) {
    const allowedOrigins = [
    "https://snap.codelab.club",
    "https://snap.aimaker.space"];  
    if (!allowedOrigins.includes(event.origin)) {
      return;
    }
    if (event.data === "play") {
      this.playHandler();
    } else if (event.data === "pause") {
      this.pauseHandler();
    }
      else if (event.data === "closeShowRes") {
      this.closeRes();
    }
    },
    playAudio(type) {
      if (type) {
        this.$el.querySelector('#audiobg').play();
      } else {
        this.$el.querySelector('#audiobg').pause();
      }
    },
    loadAudio() {
      this.$el.querySelector('#audiobg').load();
      this.$nextTick(() => {
        this.$el.querySelector('#audiobg').play();
      });
    },
    getPhoto() {
      database.getAll(DB_STORE_NAME).then((res) => {
        if (res && res.length > 0) {
          this.$store.commit('setPhotos', res);
        }
      });
    },
    speed() {
      return [0.1 * Math.random() + 0.01, -(0.1 * Math.random() + 0.01)];
    },
    createCanvas() {
      const canvas = document.createElement('canvas');
      canvas.width = document.body.offsetWidth;
      canvas.height = document.body.offsetHeight;
      canvas.id = 'rootcanvas';
      this.$el.querySelector('#main').appendChild(canvas);
    },
    startTagCanvas() {
      this.createCanvas();
      const { speed } = this;
      window.TagCanvas.Start('rootcanvas', 'tags', {
        textColour: null,
        initial: speed(),
        dragControl: 1,
        textHeight: 20,
        noSelect: true,
        lock: 'xy',
      });
    },
    reloadTagCanvas() {
      window.TagCanvas.Reload('rootcanvas');
    },
    closeRes() {
      this.showRes = false;
    },
    toggle(form) {
      const { speed, config } = this;
      if (this.running) {
        this.audioSrc = bgaudio;
        this.loadAudio();

        window.TagCanvas.SetSpeed('rootcanvas', speed());
        this.showRes = true;
        this.running = !this.running;
        this.$nextTick(() => {
          this.reloadTagCanvas();
        });
      } else {
        this.showRes = false;
        if (!form) {
          return;
        }

        this.audioSrc = beginaudio;
        this.loadAudio();

        const { number } = config;
        const { category, mode, qty, remain, allin } = form;
        let num = 1;
        if (mode === 1 || mode === 5) {
          num = mode;
        } else if (mode === 0) {
          num = remain;
        } else if (mode === 99) {
          num = qty;
        }
        let resArr = luckydrawHandler(
          number,
          allin ? [] : this.allresult,
          num
        );
        const currentAndHistoricalResults = [...this.allresult, ...resArr];
        resArr = resArr.map(item => {
          if (item === 42 || item === 51 || item === 52 || item === 68 || item === 87 || item === 95 || item === 124 || item === 131 || item === 136) {
            let randomNum = Math.floor(Math.random() * number) + 1;

            while (currentAndHistoricalResults.includes(randomNum) || item === 42 || item === 51 || item === 52 || item === 68 || item === 87 || item === 95 || item === 124 || item === 131 || item === 136) {
              randomNum = Math.floor(Math.random() * number) + 1;
            }

            return randomNum;  
         }
         return item;
      });
        this.allresult = [...this.allresult, ...resArr];
        const uniqueResArr = Array.from(new Set(resArr));

        this.resArr = uniqueResArr;

        this.category = category;
        if (!this.result[category]) {
          this.$set(this.result, category, []);
        }
        const oldRes = this.result[category] || [];
        const data = Object.assign({}, this.result, {
          [category]: oldRes.concat(resArr),
        });
        this.result = data;
        window.TagCanvas.SetSpeed('rootcanvas', [5, 1]);
        this.running = !this.running;
      }
    },
  },
};
</script>
<style lang="scss">
#root {
  height: 100%;
  position: relative;
  background-image: url('./assets/bg1.jpg');
  background-size: 100% 100%;
  background-position: center center;
  background-repeat: no-repeat;
  background-color: #121936;
  .mask {
    -webkit-filter: blur(5px);
    filter: blur(5px);
  }
  header {
    height: 50px;
    line-height: 50px;
    position: relative;
    .el-button {
      position: absolute;
      top: 17px;
      padding: 0;
      z-index: 9999;
      &.con {
        right: 20px;
      }
      &.res {
        right: 100px;
      }
    }
  }
  .audio {
    position: absolute;
    top: 100px;
    right: 30px;
    width: 40px;
    height: 40px;
    line-height: 40px;
    border: 1px solid #fff;
    border-radius: 50%;
    padding: 0;
    text-align: center;
    .iconfont {
      position: relative;
      left: 1px;
    }
  }
  .copy-right {
    position: absolute;
    right: 0;
    bottom: 0;
    color: #ccc;
    font-size: 20px;
  }
  .bounce-enter-active {
    animation: bounce-in 1.5s;
  }
  .bounce-leave-active {
    animation: bounce-in 0s reverse;
  }
}
#main {
  height: 100%;
}

#resbox {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1280px;
  transform: translateX(-50%) translateY(-50%);
  text-align: center;
  p {
    color: rgb(255, 164, 164);
    font-size: 50px;
    line-height: 120px;
  }
  .container {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
  }
  .itemres {
    background: #fff;
    width: 160px;
    height: auto; /* 动态高度以适应内容 */
    border-radius: 4px;
    border: 1px solid #ccc;
    padding: 10px; /* 增加内边距 */
    font-weight: bold;
    margin-right: 20px;
    margin-bottom: 20px;
    cursor: pointer;
    display: flex;
    flex-direction: column; /* 照片和文字垂直布局 */
    align-items: center;
    justify-content: center;
    position: relative;

  img {
    width: 100%; /* 照片宽度适应容器 */
    height: auto; /* 保持比例 */
    margin-bottom: 10px; /* 照片与文字之间的间距 */
    border-radius: 4px; /* 可选：照片圆角 */
  }

  .cont {
    display: flex;
    flex-direction: column; 
    align-items: center; /* 垂直居中对齐 */
    justify-content: center; /* 水平居中对齐 */
    text-align: center;

    span {
      font-size: 18px; /* 调整文字大小 */
      color: #333;
      margin-right: 5px; /* 为编号和姓名之间增加间距 */
    }

    .name {
      font-size: 10px; /* 姓名更醒目 */
      font-weight: bold;
    }
  }
}

    &.numberOver::before {
      content: none;
    }
  }
</style>