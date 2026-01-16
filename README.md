# EDA-KUBERNETES-PROJECT

## Description

Ce projet met en œuvre une **architecture orientée événements (Event-Driven Architecture – EDA)** déployée sur **Kubernetes**.  
Il repose sur plusieurs services conteneurisés (API, intégration et interface web) orchestrés à l’aide de manifests Kubernetes.

L’objectif est de démontrer :
- la communication entre services
- la conteneurisation avec Docker
- le déploiement et l’orchestration avec Kubernetes
- une approche DevOps moderne

---

## Prérequis

- Docker
- Kubernetes (Minikube)
- kubectl
---

## Construction des images Docker

### Service API
```bash
docker build -t api ./services/api
```
### Service Integration
```bash
docker build -t integration ./services/integration
```

### Service Web
```bash
docker build -t web ./services/web
```
## Déploiement sur Kubernetes
### Démarrer le cluster
```bash
minikube start
```
## Déployer la stack EDA
```bash
kubectl apply -f k8s/eda-stack.yaml
```

## Vérifier le déploiement
```bash
kubectl get pods
kubectl get services
```

### Arrêter le cluster
```bash
minikube stop
```
