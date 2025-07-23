# 🔐 SISTEMA UNIFICADO DE ACCESO Y ROLES - NightDreams

## 📋 RESUMEN DEL FLUJO COMPLETO

### 🎯 OBJETIVO
Crear un sistema simple, robusto y unificado que controle el acceso y roles de usuarios, incluyendo la detección de usuarios eliminados.

---

## 🔄 FLUJO COMPLETO DE REGISTRO Y ACCESO

### 1️⃣ REGISTRO/LOGIN (access.html)
```
Usuario entra → access.html
├── Ingresa: nombre, correo, contraseña
├── Sistema detecta si es Admin (official.nightdreams@gmail.com)
├── Intenta LOGIN primero
│   ├── ✅ Existe → Verifica documento Firestore
│   └── ❌ No existe → Crea cuenta nueva
├── Crea/actualiza documento usuarios con estructura unificada:
│   ├── rol: 'admin' | 'promotor' (SIEMPRE minúsculas)
│   ├── estado: 'Aprobado' | 'Pendiente'
│   └── permisos: {admin, eliminar, modificar, ver_todo}
├── Si es admin → Crea documento en colección 'admin'
├── Guarda en localStorage datos consistentes
└── Redirige a index.html
```

### 2️⃣ VERIFICACIÓN DE ACCESO (app.js)
```
app.js carga → initAuth()
├── Evita redirecciones si está en access.html o espera.html
├── Firebase Auth detecta usuario
├── Llama verificarAccesoUsuario(uid)
│   ├── Verifica si documento existe en Firestore
│   ├── Si NO existe → Usuario eliminado
│   │   ├── Limpia localStorage
│   │   ├── Cierra sesión Firebase
│   │   ├── Muestra alerta "cuenta eliminada"
│   │   └── Redirige a access.html
│   ├── Si es Admin → Acceso inmediato
│   └── Si es Promotor:
│       ├── Estado 'Aprobado' → Acceso concedido
│       └── Estado 'Pendiente' → Redirige a espera.html
├── Actualiza localStorage con datos frescos
├── Actualiza UI solo en index.html
└── Configura verificación periódica (30 segundos)
```

### 3️⃣ PÁGINAS ESPECÍFICAS

#### 🏠 **index.html** (App principal)
- ✅ Solo usuarios con acceso aprobado
- 🔄 Verificación periódica cada 30 segundos
- 🎯 UI actualizada según rol (admin/promotor)

#### ⏳ **espera.html** (Sala de espera)
- 👤 Promotores con estado 'Pendiente'
- 🔔 Configuración de notificaciones push
- 🚫 No acceso a funcionalidades principales

#### 🔑 **access.html** (Login/Registro)
- 🆕 Registro de nuevos usuarios
- 🔄 Login de usuarios existentes
- 🎯 Detección automática de admin

---

## 👥 TIPOS DE USUARIO

### 🔴 **ADMIN**
```json
{
  "correo": "official.nightdreams@gmail.com",
  "rol": "admin",
  "estado": "Aprobado",
  "permisos": {
    "admin": true,
    "eliminar": true,
    "modificar": true,
    "ver_todo": true
  }
}
```
- ✅ Acceso inmediato
- 📄 Documento en colección 'usuarios'
- 📄 Documento en colección 'admin'
- 🔔 Recibe notificaciones de nuevos promotores

### 🟢 **PROMOTOR APROBADO**
```json
{
  "correo": "promotor@ejemplo.com",
  "rol": "promotor",
  "estado": "Aprobado",
  "permisos": {
    "admin": false,
    "eliminar": false,
    "modificar": true,
    "ver_todo": false
  }
}
```
- ✅ Acceso a funcionalidades básicas
- 🎫 Puede crear/modificar reservas

### 🟡 **PROMOTOR PENDIENTE**
```json
{
  "correo": "nuevo@ejemplo.com",
  "rol": "promotor",
  "estado": "Pendiente",
  "permisos": {
    "admin": false,
    "eliminar": false,
    "modificar": true,
    "ver_todo": false
  }
}
```
- ⏳ Solo acceso a espera.html
- 🔔 Puede configurar notificaciones
- ❌ Sin acceso a app principal

### 🔴 **USUARIO ELIMINADO**
- 🗑️ Documento eliminado de Firestore
- 🔐 Auth Firebase puede persistir
- 🧹 Sistema detecta y limpia automáticamente

---

## 🛡️ CONTROLES DE SEGURIDAD

### 🔍 **Verificación en Tiempo Real**
1. **Al cargar app**: Verifica existencia en Firestore
2. **Cada 30 segundos**: Re-verifica usuario activo
3. **Al hacer acciones**: Valida permisos actuales

### 🧹 **Limpieza Automática**
1. **localStorage**: Se limpia si usuario no existe
2. **Firebase Auth**: Se cierra sesión automáticamente
3. **Tokens push**: Limpieza diaria a las 2 AM

### 🚨 **Detección de Usuario Eliminado**
```javascript
// Si usuario eliminado pero localStorage persiste:
if (!userDoc.exists) {
  limpiarSesionLocal();
  await auth.signOut();
  alert('Tu cuenta ha sido eliminada. Contacta al administrador.');
  window.location.href = 'access.html';
}
```

---

## 🔧 FUNCIONES BACKEND (functions/index.js)

### 📱 **getAdminTokens()**
- 🔍 Busca admins con ambas variantes: 'Admin' y 'admin'
- ✅ Solo usuarios con estado 'Aprobado'
- 🧹 Evita tokens duplicados

### 🔔 **Notificaciones Automáticas**
1. **Nuevo promotor** → Notifica a todos los admins
2. **Promotor aprobado** → Notifica al promotor
3. **Nueva reserva** → Notifica a admins
4. **Solicitud modificación** → Notifica a admins

### 🧹 **Limpieza Programada**
- ⏰ Diaria a las 2 AM (México)
- 🗑️ Elimina tokens FCM inválidos
- 📊 Log de resultados

---

## 💾 ESTRUCTURA LOCALSTORAGE

```javascript
// Datos guardados consistentemente:
localStorage.setItem('uid', user.uid);
localStorage.setItem('nombre', userData.nombre);
localStorage.setItem('correo', userData.correo);
localStorage.setItem('rol', userData.rol);          // 'admin' | 'promotor'
localStorage.setItem('estado', userData.estado);    // 'Aprobado' | 'Pendiente'
localStorage.setItem('esAdmin', 'true'|'false');   // Boolean como string
```

---

## 🚀 VENTAJAS DEL SISTEMA UNIFICADO

### ✅ **Consistencia**
- Roles siempre en minúsculas
- Estructura uniforme en todas las partes
- Validaciones centralizadas

### 🛡️ **Seguridad**
- Verificación en tiempo real
- Detección de usuarios eliminados
- Limpieza automática de datos

### ⚡ **Performance**
- Firebase verificación en segundo plano
- UI actualizada inmediatamente desde localStorage
- Verificaciones periódicas no bloquean UI

### 🔧 **Mantenibilidad**
- Un solo punto de control de acceso
- Funciones reutilizables
- Logs detallados para debugging

---

## 🐛 PROBLEMAS SOLUCIONADOS

1. ❌ **Bucle de redirección** → ✅ Verificación de página actual
2. ❌ **Roles inconsistentes** → ✅ Siempre minúsculas
3. ❌ **Usuario eliminado con acceso** → ✅ Verificación en tiempo real
4. ❌ **Múltiples verificaciones complejas** → ✅ Función unificada
5. ❌ **Tokens inválidos** → ✅ Limpieza automática
6. ❌ **Sin notificación a promotor** → ✅ Notificación de aprobación

---

## 🎯 RESULTADO FINAL

Un sistema robusto, simple y unificado que:
- ✅ Controla acceso en tiempo real
- ✅ Detecta usuarios eliminados automáticamente
- ✅ Mantiene consistencia de roles
- ✅ Optimiza performance con localStorage-first
- ✅ Limpia datos automáticamente
- ✅ Proporciona experiencia fluida al usuario
