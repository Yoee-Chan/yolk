# yolk
开发好的项目，只需要两步，即可完成python(ai-agent)和前端react项目打包，一键打包成windows安装包。可以实现agent的本地化部署。
以及高效前端开发能力。
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


