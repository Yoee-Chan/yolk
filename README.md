# yolk

开发好的项目，只需要两步，即可完成python(ai-agent)和前端react项目打包，一键打包成windows安装包。可以实现agent的本地化部署。
以及高效前端开发能力。
![img.png](architect.png)




## 项目的依赖安装

开发项目需要安装python和node。在conda的虚拟环境下，执行以下步骤。

* 安装node依赖

```shell
npm install
```

* 安装react依赖
  安装react的命令

```shell
npm install react react-dom
npm install --save-dev @types/react @types/react-dom
```

## 开发环境下面运行

```shell
npm run build
npm run dev
```

## 项目打包

1. 运行 python 下面的build.exe.bat
2. 运行shell:

````shell
npm run build:dev
````

```shell
conda create -n yolk python=3.11
conda activate yolk
```

## Episodic Memory Compression (EMC)记忆压缩

**EMC记忆压缩** 接近人类记忆的压缩机制，按时间、主题、关键词组织，可以顺着线索还原当时的状态，不是简单的向量检索，而是结构化记忆。
人类记忆是压缩的、模糊的、线索化的、按时间衰减的；而大模型的上下文是线性的、昂贵的、容易遗忘的。
## 为什么大模型需要“记忆压缩”

因为模型无法长期记住上下文，无法存储大量历史，无法自动组织记忆，无法主动回忆，无法模拟“人类记忆的模糊性“
该算法着重解决：

* 长期记忆
  把用户的长期偏好、习惯、历史事件压缩成结构化记忆。
* 线索回溯
  模型可以根据关键词、主题、时间线“回忆”过去。
* 上下文重建
  当模型需要时，你可以把“压缩记忆”重新展开成“当时的状态”。
* 记忆衰减
  越久远的记忆越模糊，但仍保留关键线索。

## 为三重记忆机制

* 短期记忆（Short-term Memory）
* 中期记忆
* 长期记忆图谱

## 长期记忆图谱

### 记忆图谱(Memory Graph)

* 节点
  人物 事件 主题 决策 偏好
* 边
  时间顺序 因果关系 主题关联

### 记忆衰减（Memory Decay）

越久远的记忆： 权重降低 只保留关键词 删除细节 保留结论

### 记忆重建（Memory Reconstruction）

当模型需要时： 根据关键词 根据主题 根据时间线 把相关记忆重新组合成“当时的状态”。

## 数据结构

## 衰减函数

## 线索检索算法

## 回忆重建 prompt

## 文件组织结构

## 前端的安装包
```shell
npm install react-router-dom
```

