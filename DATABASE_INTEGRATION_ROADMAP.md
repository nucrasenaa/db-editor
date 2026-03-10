# 🗺️ Data Forge | Database Integration Roadmap

เอกสารนี้แสดงรายละเอียดแผนการขยายขอบเขตการรองรับฐานข้อมูล (Database Dialects) ในอนาคตของ Data Forge เพื่อให้ครอบคลุมการใช้งานที่หลากหลายมากขึ้น ตั้งแต่ Local Development ไปจนถึงระดับ Enterprise และ Cloud Data Warehouse

---

## 🏗️ Phase 1: Local & Analytical Power (Short-term)
*เป้าหมาย: เน้นความคล่องตัวในการพัฒนาซอฟต์แวร์และการวิเคราะห์ข้อมูลบนเครื่อง local*

- [ ] **SQLite Support**
    - [ ] การเชื่อมต่อไฟล์ `.sqlite`, `.db` โดยตรงผ่าน `better-sqlite3` หรือ `sqlite3`
    - [ ] รองรับ In-memory database สำหรับการทดสอบ
    - [ ] Visual designer สำหรับสร้างตาราง SQLite แบบรวดเร็ว
- [ ] **DuckDB Integration**
    - [ ] รองรับการ Query ไฟล์ CSV/Parquet ผ่านความสามารถของ DuckDB
    - [ ] ระบบ Analytical Dashboard เบื้องต้นโดยใช้พลังของ OLAP
- [ ] **Embedded Driver Mode**
    - [ ] ระบบดาวน์โหลด driver อัตโนมัติเมื่อต้องการใช้ (Lazy loading) เพื่อลดขนาดตัวแอป

## 🏢 Phase 2: Enterprise Standards (Mid-term)
*เป้าหมาย: รองรับฐานข้อมูลที่ใช้กันแพร่หลายในองค์กรขนาดใหญ่*

- [ ] **Oracle Database Support**
    - [ ] รองรับการเชื่อมต่อผ่าน `node-oracledb` (Thin mode)
    - [ ] แผนภาพ Execution Plan เฉพาะของ Oracle
    - [ ] ระบบจัดการ User/Permissions และ Tablespace
- [ ] **Microsoft Access (JET/ACE)**
    - [ ] รองรับการอ่านและส่งออกข้อมูลจากไฟล์ `.mdb`, `.accdb` (เน้นงาน Legacy)
- [ ] **Firebird / Interbase**
    - [ ] รองรับ SQL Dialect ของ Firebird สำหรับระบบ ERP ขนาดกลาง

## 🚀 Phase 3: NoSQL & Key-Value Stores (Mid-term)
*เป้าหมาย: ก้าวข้ามขีดจำกัดของ Relational DB สู่ Modern Data Architecture*

- [x] **MongoDB (Document-based) - (Core Driver & Connection Engine)**
    - [x] Visual Document Explorer (Tree View สำหรับ JSON)
    - [x] ระบบเปลี่ยน Natural Language เป็น MongoDB Aggregation Pipelines
    - [x] Schema discovery สำหรับ Collection ที่ไม่มีโครงสร้างตายตัว (Basic listCollections Supported)
- [x] **Redis (Key-Value Browser) - (Core Driver & CLI Emulation)**
    - [x] ระบบ List/Hash/Set explorer
    - [x] Real-time monitoring ของ memory usage
    - [x] CLI แบบ interactive ภายใน Data Forge (Basic Support via Query Box)

## ☁️ Phase 4: Cloud Data Warehouses & Big Data (Long-term)
*เป้าหมาย: จัดการข้อมูลระดับ Terabyte/Petabyte บน Cloud*

- [ ] **Snowflake & BigQuery**
    - [ ] รองรับการเชื่อมต่อผ่าน OAuth/Service Account
    - [ ] ระบบตรวจสอบ Cost Estimation ก่อนรัน Query ขนาดใหญ่
- [ ] **ClickHouse (OLAP)**
    - [ ] รองรับการ Query ข้อมูล Log จำนวนมากด้วยความเร็วสูง
    - [ ] ระบบ Visualization ที่เหมาะสมกับ High-cardinality data
- [x] **Apache Kafka (Event Streaming / Message Broker)**
    - [x] รองรับการดูข้อมูลใน Topics (Consumer UI)
    - [x] ระบบ Publish message ทดสอบไปยัง Topics
    - [ ] การเชื่อมต่อแบบ Schema Registry รองรับ Avro/Protobuf

---

## 🛠️ Architecture Refactoring Plan
เพื่อให้รองรับฐานข้อมูลจำนวนมากได้อย่างมีประสิทธิภาพ เรามีแผนปรับปรุงโครงสร้างภายในดังนี้:

1. **Modular Driver System**: แยก Driver ของแต่ละ DB ออกเป็น plugin เพื่อไม่ให้แอปหนักเกินไป
2. **Enhanced Dialect Abstraction**:
    - สร้าง Interface มาตรฐานสำหรับ `MetadataFetcher`, `ExecutionPlanVisualizer`, และ `DDLGenerator`
    - พัฒนา SQL Parser ที่ฉลาดขึ้นเพื่อรองรับ Dialect ที่แตกต่างกัน (โดยเฉพาะ NoSQL)
3. **Unified Connection Manager**: ระบบจัดการ Connection String และ SSH Tunneling ที่เป็นมาตรฐานเดียวกันทุก DB

---

## 📝 วิธีส่งคำขอเพิ่มฐานข้อมูล
หากท่านต้องการให้เรารองรับฐานข้อมูลชนิดใหม่ สามารถแจ้งความประสงค์ได้ที่:
- **GitHub Issues**: `[Dialect Request] <Database Name>`
- **Community Forum**: หมวดหมู่ Feature Requests
