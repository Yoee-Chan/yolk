FROM docker.m.daocloud.io/library/maven:3.9.9-eclipse-temurin-17 AS builder
WORKDIR /build

COPY pom.xml ./
COPY src ./src
RUN mvn -B -DskipTests clean package

FROM docker.m.daocloud.io/library/eclipse-temurin:17-jre-jammy
WORKDIR /app

ENV JAVA_OPTS="-Xms256m -Xmx512m -XX:+UseG1GC -XX:MaxMetaspaceSize=192m"
ENV SPRING_PROFILES_ACTIVE=sit
ENV SERVER_PORT=8080
ENV SERVER_SSL_ENABLED=true
ENV SERVER_SSL_KEY_STORE=file:/apt/ssl/www.danhuang.org.cn.p12
ENV SERVER_SSL_KEY_STORE_TYPE=PKCS12
ENV SERVER_SSL_KEY_STORE_PASSWORD=change-me
ENV SERVER_SSL_KEY_ALIAS=www.danhuang.org.cn

COPY --from=builder /build/target/*.jar /app/app.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/app.jar --spring.profiles.active=${SPRING_PROFILES_ACTIVE}"]
