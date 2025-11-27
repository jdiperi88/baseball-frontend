pipeline {
    agent any 

    stages {
        stage('Build Docker Image') {
            steps {
                script {
                    sh 'make build-image'
                }
            }
        }

        stage('Run Docker Container') {
            steps {
                script {
                    sh 'make run-container'
                }
            }
        }

        stage('Copy Data from Container to Host') {
            steps {
                script {
                    sh 'make copy-data'
                }
            }
        }

        stage('Clean Up Container') {
            steps {
                script {
                    sh 'make clean-container'
                }
            }
        }

        stage('Update Nginx Kubernetes Deployment') {
            when {
                // Only run this stage if previous stages were successful
                expression { currentBuild.resultIsBetterOrEqualTo('SUCCESS') }
            }
            steps {
                script {
                    // Update the Kubernetes deployment using Makefile
                    sh "make update-nginx"
                }
            }
        }
    }
}
