.PHONY: build-image run-container

# Define variables
IMAGE_NAME=baseball-frontend
VOLUME_NAME=baseball-frontend-volume
HOST_PATH=/volumes/sites/baseball-frontend
CONTAINER_PATH=/app/build

build-image:
	@docker build -t $(IMAGE_NAME) .

# Use a named volume to store the build artifacts
run-container:
	-docker volume inspect $(VOLUME_NAME) >/dev/null 2>&1 && docker volume rm $(VOLUME_NAME) || true
	@docker run --name $(IMAGE_NAME)-container -v $(VOLUME_NAME):$(CONTAINER_PATH) $(IMAGE_NAME)

# Use a helper container to copy data from the volume to the host
copy-data:
	@docker run --rm -v $(VOLUME_NAME):/from -v $(HOST_PATH):/to alpine ash -c "cp -r /from/* /to/"

clean-container:
	@docker rm -v $(IMAGE_NAME)-container

# Update Docker image in Kubernetes
.PHONY: update-nginx
update-nginx:
	kubectl rollout restart deployment nginx-deployment

.PHONY: build
build:
	npm run build