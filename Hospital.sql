-- MySQL dump 10.13  Distrib 8.0.38, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: asistencia
-- ------------------------------------------------------
-- Server version	8.0.39

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `alertas`
--

DROP TABLE IF EXISTS `alertas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `alertas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `tipo_alerta` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `fecha_hora` datetime NOT NULL,
  `estado` enum('PENDIENTE','RESUELTA') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDIENTE',
  PRIMARY KEY (`id`),
  KEY `idx_alert_emp_time` (`empleado_id`,`fecha_hora`),
  KEY `idx_alert_estado` (`estado`,`fecha_hora`),
  CONSTRAINT `fk_alert_emp` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `alertas`
--

LOCK TABLES `alertas` WRITE;
/*!40000 ALTER TABLE `alertas` DISABLE KEYS */;
/*!40000 ALTER TABLE `alertas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `area_supervisor_roles`
--

DROP TABLE IF EXISTS `area_supervisor_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `area_supervisor_roles` (
  `area_id` int NOT NULL,
  `rol_id` int NOT NULL,
  PRIMARY KEY (`area_id`,`rol_id`),
  KEY `fk_asr_rol` (`rol_id`),
  CONSTRAINT `fk_asr_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_asr_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles_empleado` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `area_supervisor_roles`
--

LOCK TABLES `area_supervisor_roles` WRITE;
/*!40000 ALTER TABLE `area_supervisor_roles` DISABLE KEYS */;
/*!40000 ALTER TABLE `area_supervisor_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `area_supervisores`
--

DROP TABLE IF EXISTS `area_supervisores`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `area_supervisores` (
  `area_id` int NOT NULL,
  `empleado_id` int NOT NULL,
  `es_titular` tinyint(1) NOT NULL DEFAULT '0',
  `desde` date DEFAULT NULL,
  `hasta` date DEFAULT NULL,
  `creado_por` int DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`area_id`,`empleado_id`),
  KEY `fk_as_emp` (`empleado_id`),
  KEY `fk_as_usr` (`creado_por`),
  CONSTRAINT `fk_as_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_as_emp` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_as_usr` FOREIGN KEY (`creado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `area_supervisores`
--

LOCK TABLES `area_supervisores` WRITE;
/*!40000 ALTER TABLE `area_supervisores` DISABLE KEYS */;
/*!40000 ALTER TABLE `area_supervisores` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `areas`
--

DROP TABLE IF EXISTS `areas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `areas` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre_area` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eliminado_en` timestamp NULL DEFAULT NULL,
  `creado_por` int DEFAULT NULL,
  `actualizado_por` int DEFAULT NULL,
  `eliminado_por` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre_area` (`nombre_area`),
  KEY `fk_area_creado_por` (`creado_por`),
  KEY `fk_area_actualizado_por` (`actualizado_por`),
  KEY `fk_area_eliminado_por` (`eliminado_por`),
  KEY `idx_area_nombre` (`nombre_area`),
  CONSTRAINT `fk_area_actualizado_por` FOREIGN KEY (`actualizado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_area_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_area_eliminado_por` FOREIGN KEY (`eliminado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `areas`
--

LOCK TABLES `areas` WRITE;
/*!40000 ALTER TABLE `areas` DISABLE KEYS */;
/*!40000 ALTER TABLE `areas` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asignacion_turnos`
--

DROP TABLE IF EXISTS `asignacion_turnos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asignacion_turnos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `turno_id` int NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  `lote_id` int DEFAULT NULL,
  `creado_por` int DEFAULT NULL,
  `eliminado_en` timestamp NULL DEFAULT NULL,
  `eliminado_por` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asig_empleado_rango` (`empleado_id`,`turno_id`,`fecha_inicio`,`fecha_fin`),
  KEY `fk_asig_lote` (`lote_id`),
  KEY `fk_asig_creado` (`creado_por`),
  KEY `fk_asig_elim` (`eliminado_por`),
  KEY `idx_asig_empleado_fecha` (`empleado_id`,`fecha_inicio`,`fecha_fin`),
  KEY `idx_asig_turno_fecha` (`turno_id`,`fecha_inicio`,`fecha_fin`),
  KEY `idx_asig_rango` (`fecha_inicio`,`fecha_fin`),
  CONSTRAINT `fk_asig_creado` FOREIGN KEY (`creado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asig_elim` FOREIGN KEY (`eliminado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asig_emp` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asig_lote` FOREIGN KEY (`lote_id`) REFERENCES `asignaciones_lote` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asig_turno` FOREIGN KEY (`turno_id`) REFERENCES `turnos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asignacion_turnos`
--

LOCK TABLES `asignacion_turnos` WRITE;
/*!40000 ALTER TABLE `asignacion_turnos` DISABLE KEYS */;
/*!40000 ALTER TABLE `asignacion_turnos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asignacion_turnos_fijos`
--

DROP TABLE IF EXISTS `asignacion_turnos_fijos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asignacion_turnos_fijos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `turno_id` int NOT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eliminado_en` timestamp NULL DEFAULT NULL,
  `creado_por` int DEFAULT NULL,
  `eliminado_por` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asig_fija_empleado_activo` (`empleado_id`,`activo`),
  KEY `fk_asig_fija_turno` (`turno_id`),
  KEY `fk_asig_fija_creado` (`creado_por`),
  KEY `fk_asig_fija_eliminado` (`eliminado_por`),
  CONSTRAINT `fk_asig_fija_creado` FOREIGN KEY (`creado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asig_fija_eliminado` FOREIGN KEY (`eliminado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_asig_fija_emp` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asig_fija_turno` FOREIGN KEY (`turno_id`) REFERENCES `turnos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asignacion_turnos_fijos`
--

LOCK TABLES `asignacion_turnos_fijos` WRITE;
/*!40000 ALTER TABLE `asignacion_turnos_fijos` DISABLE KEYS */;
/*!40000 ALTER TABLE `asignacion_turnos_fijos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asignaciones_lote`
--

DROP TABLE IF EXISTS `asignaciones_lote`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asignaciones_lote` (
  `id` int NOT NULL AUTO_INCREMENT,
  `area_id` int NOT NULL,
  `jefe_id` int NOT NULL,
  `turno_id` int NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `patron` enum('NORMAL','24x72') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'NORMAL',
  `dias_descanso` set('0','1','2','3','4','5','6') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_por` int DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_lote_jefe` (`jefe_id`),
  KEY `fk_lote_turno` (`turno_id`),
  KEY `fk_lote_user` (`creado_por`),
  KEY `idx_lote_area_fecha` (`area_id`,`fecha_inicio`,`fecha_fin`),
  CONSTRAINT `fk_lote_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`),
  CONSTRAINT `fk_lote_jefe` FOREIGN KEY (`jefe_id`) REFERENCES `empleados` (`id`),
  CONSTRAINT `fk_lote_turno` FOREIGN KEY (`turno_id`) REFERENCES `turnos` (`id`),
  CONSTRAINT `fk_lote_user` FOREIGN KEY (`creado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asignaciones_lote`
--

LOCK TABLES `asignaciones_lote` WRITE;
/*!40000 ALTER TABLE `asignaciones_lote` DISABLE KEYS */;
/*!40000 ALTER TABLE `asignaciones_lote` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `asistencias`
--

DROP TABLE IF EXISTS `asistencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `asistencias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `empleado_id` int NOT NULL,
  `fecha` date NOT NULL,
  `turno_id` int NOT NULL,
  `entrada_real` datetime DEFAULT NULL,
  `salida_real` datetime DEFAULT NULL,
  `estado` enum('COMPLETO','INCOMPLETO','FALTA','TARDE','TEMPRANO') COLLATE utf8mb4_unicode_ci NOT NULL,
  `minutos_retraso` int DEFAULT '0',
  `minutos_extra` int DEFAULT '0',
  `generado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_asistencia_emp_fecha` (`empleado_id`,`fecha`),
  KEY `fk_asistencia_turno` (`turno_id`),
  KEY `idx_asistencia_estado` (`estado`,`fecha`),
  CONSTRAINT `fk_asistencia_emp` FOREIGN KEY (`empleado_id`) REFERENCES `empleados` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_asistencia_turno` FOREIGN KEY (`turno_id`) REFERENCES `turnos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `asistencias`
--

LOCK TABLES `asistencias` WRITE;
/*!40000 ALTER TABLE `asistencias` DISABLE KEYS */;
/*!40000 ALTER TABLE `asistencias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `audit_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `evento` enum('CREATE','UPDATE','DELETE','ASSIGN','UNASSIGN','LOGIN','EMAIL') COLLATE utf8mb4_unicode_ci NOT NULL,
  `entidad` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `entidad_id` bigint DEFAULT NULL,
  `antes` json DEFAULT NULL,
  `despues` json DEFAULT NULL,
  `actor_id` int DEFAULT NULL,
  `actor_username` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `user_agent` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `request_id` char(36) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_entidad` (`entidad`,`entidad_id`,`creado_en`),
  KEY `idx_audit_actor` (`actor_id`,`creado_en`),
  CONSTRAINT `fk_audit_actor` FOREIGN KEY (`actor_id`) REFERENCES `usuarios_sistema` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `empleados`
--

DROP TABLE IF EXISTS `empleados`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `empleados` (
  `id` int NOT NULL AUTO_INCREMENT,
  `numero_empleado` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nombre_completo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rol_id` int DEFAULT NULL,
  `area_id` int DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `creado_por` int DEFAULT NULL,
  `actualizado_por` int DEFAULT NULL,
  `eliminado_en` timestamp NULL DEFAULT NULL,
  `eliminado_por` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_empleado` (`numero_empleado`),
  KEY `fk_emp_rol` (`rol_id`),
  KEY `fk_emp_area` (`area_id`),
  KEY `fk_emp_creado_por` (`creado_por`),
  KEY `fk_emp_actualizado_por` (`actualizado_por`),
  KEY `fk_emp_eliminado_por` (`eliminado_por`),
  KEY `idx_emp_nombre` (`nombre_completo`),
  KEY `idx_emp_activo` (`activo`),
  CONSTRAINT `fk_emp_actualizado_por` FOREIGN KEY (`actualizado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_emp_area` FOREIGN KEY (`area_id`) REFERENCES `areas` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_emp_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_emp_eliminado_por` FOREIGN KEY (`eliminado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_emp_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles_empleado` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `empleados`
--

LOCK TABLES `empleados` WRITE;
/*!40000 ALTER TABLE `empleados` DISABLE KEYS */;
/*!40000 ALTER TABLE `empleados` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `notificacion_log`
--

DROP TABLE IF EXISTS `notificacion_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `notificacion_log` (
  `id` int NOT NULL AUTO_INCREMENT,
  `tipo` enum('EMAIL','PUSH') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'EMAIL',
  `asunto` varchar(900) COLLATE utf8mb4_unicode_ci NOT NULL,
  `destinatarios` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `payload` json DEFAULT NULL,
  `resultado` enum('OK','ERROR') COLLATE utf8mb4_unicode_ci NOT NULL,
  `error_mensaje` text COLLATE utf8mb4_unicode_ci,
  `creado_por` int DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_notif_user` (`creado_por`),
  KEY `idx_notif_fecha` (`creado_en`),
  CONSTRAINT `fk_notif_user` FOREIGN KEY (`creado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `notificacion_log`
--

LOCK TABLES `notificacion_log` WRITE;
/*!40000 ALTER TABLE `notificacion_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `notificacion_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles_empleado`
--

DROP TABLE IF EXISTS `roles_empleado`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles_empleado` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre_rol` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `nivel` tinyint NOT NULL DEFAULT '1',
  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `supervisa_global` tinyint(1) NOT NULL DEFAULT '0',
  `seccion_plantilla` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eliminado_en` timestamp NULL DEFAULT NULL,
  `creado_por` int DEFAULT NULL,
  `actualizado_por` int DEFAULT NULL,
  `eliminado_por` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre_rol` (`nombre_rol`),
  KEY `fk_rol_creado_por` (`creado_por`),
  KEY `fk_rol_actualizado_por` (`actualizado_por`),
  KEY `fk_rol_eliminado_por` (`eliminado_por`),
  KEY `idx_roles_emp_nivel` (`nivel`),
  CONSTRAINT `fk_rol_actualizado_por` FOREIGN KEY (`actualizado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rol_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_rol_eliminado_por` FOREIGN KEY (`eliminado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles_empleado`
--

LOCK TABLES `roles_empleado` WRITE;
/*!40000 ALTER TABLE `roles_empleado` DISABLE KEYS */;
/*!40000 ALTER TABLE `roles_empleado` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roles_sistema`
--

DROP TABLE IF EXISTS `roles_sistema`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roles_sistema` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre_rol` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre_rol` (`nombre_rol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roles_sistema`
--

LOCK TABLES `roles_sistema` WRITE;
/*!40000 ALTER TABLE `roles_sistema` DISABLE KEYS */;
/*!40000 ALTER TABLE `roles_sistema` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `turnos`
--

DROP TABLE IF EXISTS `turnos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `turnos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre_turno` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `codigo_plantilla` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `hora_inicio` time NOT NULL,
  `hora_fin` time NOT NULL,
  `minutos_descanso` int NOT NULL DEFAULT '0',
  `tolerancia_entrada_minutos` int NOT NULL DEFAULT '10',
  `tolerancia_salida_minutos` int NOT NULL DEFAULT '10',
  `cruza_medianoche` tinyint(1) NOT NULL DEFAULT '0',
  `tipo_turno` enum('FIJO','ROTATIVO') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ROTATIVO',
  `dias_laborales` set('1','2','3','4','5','6','0') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'Lunes=1 ... Domingo=0',
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eliminado_en` timestamp NULL DEFAULT NULL,
  `creado_por` int DEFAULT NULL,
  `actualizado_por` int DEFAULT NULL,
  `eliminado_por` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_turno_horas` (`hora_inicio`,`hora_fin`),
  KEY `fk_turno_creado_por` (`creado_por`),
  KEY `fk_turno_actualizado_por` (`actualizado_por`),
  KEY `fk_turno_eliminado_por` (`eliminado_por`),
  CONSTRAINT `fk_turno_actualizado_por` FOREIGN KEY (`actualizado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_turno_creado_por` FOREIGN KEY (`creado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_turno_eliminado_por` FOREIGN KEY (`eliminado_por`) REFERENCES `usuarios_sistema` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `turnos`
--

LOCK TABLES `turnos` WRITE;
/*!40000 ALTER TABLE `turnos` DISABLE KEYS */;
/*!40000 ALTER TABLE `turnos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuarios_sistema`
--

DROP TABLE IF EXISTS `usuarios_sistema`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios_sistema` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `keycloak_sub` char(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `nombre_completo` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rol_id` int DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT '1',
  `creado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `keycloak_sub` (`keycloak_sub`),
  KEY `fk_usr_rol` (`rol_id`),
  CONSTRAINT `fk_usr_rol` FOREIGN KEY (`rol_id`) REFERENCES `roles_sistema` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuarios_sistema`
--

LOCK TABLES `usuarios_sistema` WRITE;
/*!40000 ALTER TABLE `usuarios_sistema` DISABLE KEYS */;
/*!40000 ALTER TABLE `usuarios_sistema` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-11-14 11:10:14
