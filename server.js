import express from "express";
import mysql from "mysql";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import dotenv from "dotenv";
dotenv.config(); // Load .env variables


const app = express();
app.use(cookieParser());

app.use(
  cors({
    origin: ["https://prostaysite.netlify.app"],
    credentials: true,
    methods: ["POST", "GET", "PUT", "DELETE"],
  })
);

app.use(express.json());
app.use(express.static("public"));

// Configure connection pool
const pool = mysql.createPool({
  connectionLimit: 5, // Adjust the limit as per your needs
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectTimeout: 30000,  // Increase timeout to 30 seconds
  timeout: 30000          // Set connection timeout
});

// Helper function to query using the connection pool
const query = (sql, values = []) =>
  new Promise((resolve, reject) => {
    pool.query(sql, values, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "./public/images");
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + "_" + Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
});


// ###########Manage Properties##############

// Adding new campaign
app.post("/createNewProperty", upload.single("image"), async (req, res) => {
    const { title, price, bedrooms, type, bathrooms, address, city, description, userId } = req.body;
    const image = req.file?.filename || null;
  try {
    const sql = "INSERT INTO properties (`title`, `price`, `bedrooms`, `type`, `bathrooms`, `address`, `city`, `description`, `image`, `landlord_id`) VALUES (?)";
    const values = [title, price, bedrooms, type, bathrooms, address, city, description, image, userId];
    await query(sql, [values]);
    res.json({ Status: "Success", message: "Property successfully created!" });
  } catch (error) {
    console.error("Error creating property:", error);
    res.status(500).json({ error: "An error occurred while creating a property" });
  }
});

// get all properties
app.get("/getProperties", async (req, res) => {
  try {
    const results = await query("SELECT * FROM properties ORDER BY id DESC");
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.json({ Error: "Get  properties data error in SQL" });
  }
});

// // get properties based on user ids 
// app.get("/getPropertiesByLandlord/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     const sql = `
//     SELECT 
//       p.id,
//       p.title,
//       p.bedrooms,
//       p.price,
//       p.type,
//       p.bathrooms,
//       p.address,
//       p.city,
//       p.image,
//       u.photo,
//       CASE 
//         WHEN f.userId IS NOT NULL THEN 1 
//         ELSE 0 
//       END AS liked
//     FROM 
//       properties p 
//     JOIN 
//       users u ON p.landlord_id = u.id
//     LEFT JOIN favorites f 
//       ON f.property_id = p.id AND f.userId = ?;`; // Changed to LEFT JOIN
     
//     const results = await query(sql, [id]);
//     res.json({ success: true, Result: results });
//   } catch (error) {
//     console.error("Error fetching properties:", error);
//     res.status(500).json({ success: false, message: "Internal Server Error" });
//   }
// });


app.get("/getPropertiesByLandlord/:id?", async (req, res) => {
  const { id } = req.params; // id is optional

  try {
    let sql;
    let values = [];

    if (id) {
      // Logged-in user: Fetch properties with favorite status
      sql = `
      SELECT 
        p.id,
        p.title,
        p.bedrooms,
        p.price,
        p.type,
        p.bathrooms,
        p.address,
        p.city,
        p.image,
        u.photo,
        CASE 
          WHEN f.userId IS NOT NULL THEN 1 
          ELSE 0 
        END AS liked
      FROM 
        properties p 
      JOIN 
        users u ON p.landlord_id = u.id
      LEFT JOIN favorites f 
        ON f.property_id = p.id AND f.userId = ?;`;

      values = [id]; // Pass userId to check favorites
    } else {
      // Logged-out user: Fetch properties without favorite status
      sql = `
      SELECT 
        p.id,
        p.title,
        p.bedrooms,
        p.price,
        p.type,
        p.bathrooms,
        p.address,
        p.city,
        p.image,
        u.photo,
        0 AS liked  -- Default to not liked
      FROM 
        properties p 
      JOIN 
        users u ON p.landlord_id = u.id;`;
      
      values = []; // No need for userId
    }

    const results = await query(sql, values);
    res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching properties:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});



// updating property status 
app.put("/updatePropertyStatus/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
      const sql = "UPDATE properties SET status = ? WHERE id = ?";
      await query(sql, [status, id])
      res.json({ Status: "Success", message: "Status updated successfully" });
  } catch (error) {
      res.json({ Status: "Error", Error: "Error updating property status" });
  }
});

// get single property details 
app.get("/getPropertyDetails/:id", async (req, res) => {
  const id = req.params.id;
  try {
    // const sql =  `Select * From properties Where id = ?` 
    const sql = `
    SELECT 
    p.id,
    p.title,
    p.bedrooms,
    p.price,
    p.type,
    p.landlord_id,
    p.bathrooms,
    p.status,
    p.address,
    p.city,
    p.description,
    p.image,
    u.photo,
    u.phone,
    u.id,
    u.name
     FROM properties p 
     JOIN users u ON p.landlord_id = u.id WHERE p.id = ?;`;
    const results = await query(sql, [id])
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.log("Failed to fetch property details", error)
    res.json({ Error: "Get movie error in SQL" });
  }
});

// update all property details 
app.put("/updateProperty/:id",  async (req, res) =>{
  const id = req.params.id;
  const { title, bedrooms, price, type, bathrooms, address, city, description } = req.body;

  if (!title || !bedrooms || !price || !type || !bathrooms || !address || !city || !description) {
    return res.json({ Status: "Error", Error: "All fields are required" });
}

  try {
    const sql = "UPDATE properties SET  title =?,  bedrooms =?, price =?, type =?, bathrooms =?, address =?, city =?, description =? WHERE id = ?";
    await query(sql, [title, bedrooms, price, type, bathrooms, address, city, description,  id]);
    res.json({ Status: "Success", message: "Property successfully updated" });
  } catch (error) {
   console.error("Error updating property in database", error);
    res.json({ Status: "Error", Error: "Failed to update property details. Please try again." });
  }
})

// deleting a selected property 
app.delete("/deleteProperty/:id", async (req, res) =>{
  const id = req.params.id;
  try {
    const sql = "Delete FROM properties WHERE id = ?";
    await query(sql, [id]);
    res.json({Status: "Success"})
  } catch (error) {
    console.log("Failed to delete property:", error)
    res.json({Error: "delete property error in sql"});
  }
})

app.get('/countProperties', async  (req, res) => {
  try {
    const sql = `SELECT COUNT(*) AS properties FROM properties`;
    const results = await query(sql);
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.error("Error getting properties count:", error);
  }
})

//   add favorites menus 
app.post("/toggleFavorites", async (req, res) => {
  const { property_id, userId } = req.body;
  try {
    const sql = "SELECT * FROM favorites WHERE property_id = ? AND userId = ?";
    const results = await query(sql, [property_id, userId])
      if (results.length > 0) {
        const deleteSql = "DELETE FROM favorites WHERE id = ?";
        await query(deleteSql, [results[0].id])
        res.json({ success: true, liked: false });
      } else {
        const insertSql = "INSERT INTO favorites (property_id, userId) VALUES (?, ?)";
        await query(insertSql, [property_id, userId])
          res.json({ success: true, liked: true });
      };
  } catch (error) {
    console.error("Error toggling like:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/userFavorites/:id", async(req, res) => {
  const { id } = req.params;
  try {
    const sql = `
    SELECT 
    p.id,
    p.title,
    p.bedrooms,
    p.price,
    p.type,
    p.bathrooms,
    p.address,
    p.city,
    p.image,
    u.photo,
    u.id
    AS liked
     FROM
      properties p 
      JOIN
      users u ON p.landlord_id = u.id
      JOIN 
      favorites f ON p.id = f.property_id
       WHERE f.userId = ?;
  `;
     const results = await query(sql, [id]);
      res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching properties:", error);
  }
});
// ###########End Manage Properties##############

// manage users 

// create new user 
const saltRounds = 10;
app.post("/createNewUser", upload.single("photo"), async (req, res) => {
  const { name, email, phone, password, role } = req.body;
  const photo = req.file?.filename || null;

  if (!name || !email || !phone || !role) {
    return res.json({ Status: "Error", Error: "All fields are required" });
}

  try {
    const existingUser = await query("SELECT * FROM users WHERE email = ?", [email]);
    if (existingUser.length > 0) {
      return res.status(409).json({
        Status: "Exists",
        message: "User already exists. Please log in.",
      });
    }
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const sql = "INSERT INTO users (`name`, `email`,`phone`, `password`, `role`,  `photo`) VALUES (?)";
    const values = [name, email, phone, hashedPassword, role, photo];
    await query(sql, [values]);
    res.json({ Status: "Success", message: "User successfully registered!" });
  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({ error: "An error occurred while adding the user." });
  }
});

// get users 
app.get("/getUsers", async (req, res) => {
  try {
    const results = await query("SELECT * FROM users ORDER BY id DESC");
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.error("Error fetching users", error);
    res.json({ Error: "Get users data error in SQL" });
  }
});

// count users 
app.get('/countUsers', async  (req, res) => {
  try {
    const sql = `SELECT COUNT(*) AS users FROM users`;
    const results = await query(sql);
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.error("Error getting users count:", error);
  }
})

// getting users based on roles 
  app.get("/getUsers/:role", async (req, res) => {
    const { role } = req.params;
    try {
      // Query to fetch movies with or without user_id
      const sql = `SELECT* FROM users WHERE role =? ORDER BY id DESC `;
  
      // const queryParams = [user_id || null, category]; // Use null if user_id is not provided
      const results = await query(sql, [role])
        return res.json({ success: true, Result: results });
    } catch (error) {
      console.error("Error fetching cakes:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

// counting user roles 

// count user roles 
app.get('/roleCounts', async (req, res) => {
  try {
    const sql = `SELECT role, COUNT(*) AS count FROM users GROUP BY role`;
    query(sql, (error, rows) => {
      if (error) {
        console.error('Error fetching role counts:', error);
        return res.status(500).json({ success: false, message: 'Error calculating role counts' });
      }
      const roleCounts = {
        tenant: 0,
        landlord: 0,
      };
      rows.forEach(row => {
        roleCounts[row.role.toLowerCase()] = row.count;
      });

      res.json({ success: true, Result: roleCounts });
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// user login 
app.post("/userLogin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const users = await query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
      return res
        .status(401)
        .json({ Status: "Error", message: "User not found. Please register." });
    }
    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ Status: "Error", message: "Incorrect password." });
    }
    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, photo: user.photo, role: user.role },
      "jwt-secret-key",
      { expiresIn: "1d" }
    );
    res.cookie("token", token);
     return res.status(200).json({
      Status: "Success",
      message: "Login successful!",
      token,
      user: { id: user.id, name: user.name, email: user.email, photo: user.photo, role: user.role },
    });
  } catch (err) {
    console.error("Error logging in user:", err);
    res.status(500).json({ error: "An error occurred during login." });
  }
});


// verify user 
const verifyUser = (req, res, next) => {
  const token = req.cookies.token; 
  console.log("Cookies Object in /dashboard:", req.cookies); 
  console.log("Extracted Token:", token);     

  if (!token) {
      console.log("Token Missing");
      return res.status(401).json({ Error: "User not authenticated!" });
  }

  jwt.verify(token, "jwt-secret-key", (err, decoded) => {
      if (err) {
          console.log("Token Verification Failed:", err); 
          return res.status(403).json({ Error: "Invalid or expired token!" });
      }
      console.log("Decoded Token:", decoded);        
      req.role = decoded.role;
      req.id = decoded.id;
      next(); 
  });
};

// protecting routes 
// Middleware to check admin role
const verifyAdmin = (req, res, next) => {
  if (req.role !== "admin") {
      return res.status(403).json({ Error: "Access denied! Admins only." });
  }
  next();
};

// Routes with role protection
app.get("/admin", verifyUser, verifyAdmin, (req, res) => {
  return res.json({ Status: "Success", role: req.role, id: req.id });
});

app.get("/tenant", verifyUser, (req, res) =>{
  return res.json({Status: "Success", role: req.role, id: req.id});
})

app.get("/landlord", verifyUser, (req, res) =>{
  return res.json({Status: "Success", role: req.role, id: req.id});
})

// End manage users 

// manage landlord 
app.get("/getMyProperties/:id", async(req, res) => {
  const { id } = req.params;
  try {
    const sql = `
    SELECT 
    p.id,
    p.title,
    p.bedrooms,
    p.price,
    p.type,
    p.bathrooms,
    p.status,
    p.address,
    p.city,
    p.description,
    p.image,
    p.landlord_id,
    u.photo
     FROM properties p JOIN users u ON p.landlord_id = u.id WHERE u.id = ?;`;
     const results = await query(sql, [id]);
      res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching properties:", error);
  }
});

app.get('/countProperties/:userId', async  (req, res) => {
  const { userId } = req.params;
  try {
    const sql = `SELECT COUNT(*) AS properties FROM properties WHERE landlord_id = ?`;
    const results = await query(sql, [userId]);
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.error("Error getting properties count:", error);
  }
})


// count landlord booked properties 
app.get('/countMyBookedProperties/:userId', async  (req, res) => {
  const { userId } = req.params;
  try {
    const sql = `SELECT COUNT(*) AS booked FROM bookings WHERE landlord_id = ?`;
    const results = await query(sql, [userId]);
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.error("Error getting booked properties count:", error);
  }
})

// count payment landlord properties 
app.get('/countMyPaymentsProperties/:userId', async  (req, res) => {
  const { userId } = req.params;
  try {
    const sql = `SELECT COUNT(*) AS payments FROM payment WHERE landlord_id = ?`;
    const results = await query(sql, [userId]);
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.error("Error getting payments properties count:", error);
  }
})

// get user bookings 
app.get("/getMyBookedProperty/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      SELECT 
        p.id,
        p.title,
        p.bedrooms,
        p.price,
        p.type,
        p.bathrooms,
        p.address,
        p.description,
        p.city,
        p.image,
        b.id,
        b.status,
        u.name,
        u.email,
        u.photo,
        m.status AS payment_status
      FROM bookings b
      JOIN users u ON b.user_id = u.id 
      JOIN properties p ON b.property_id = p.id
      JOIN payment m ON m.property_id = b.property_id
      WHERE b.landlord_id = ?;
    `;
    const results = await query(sql, [id]);
    res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/getMyPaymentsProperty/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      SELECT 
        m.id,
        m.status,
        m.paid,
        p.id,
        p.title,
        p.bedrooms,
        p.price,
        p.type,
        p.bathrooms,
        p.address,
        p.description,
        p.city,
        p.image
      FROM payment m
      JOIN properties p ON m.property_id = p.id
      WHERE m.landlord_id = ?;
    `;

    const results = await query(sql, [id]);
    res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching user payments:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// end manage landlord 

// manage bookings 
// booking 
app.post('/booking', async (req, res) => {
  const { propertyId, landlordId, userId  } = req.body;
  try {
    if (!userId || !propertyId) {
      return res.status(400).json({ error: 'User ID and property ID are required' });
  }
  const checkSql = `SELECT * FROM bookings WHERE  property_id = ? AND user_id = ?`;
  const results = await query(checkSql, [propertyId, userId])
  if (results.length > 0) {
    return res.status(400).json({ message: 'Property is already in your bookings' });
} else {
    const insertSql = `INSERT INTO bookings (property_id, landlord_id, user_id) VALUES (?, ?, ?)`;
    const paymentSql = `INSERT INTO payment (property_id, landlord_id, user_id) VALUES (?, ?, ?)`;
    await query(insertSql, [propertyId, landlordId, userId])
    await query(paymentSql, [propertyId, landlordId, userId])
      res.status(200).json({ message: 'Property successfully booked!' });
}
  } catch (error) {
    console.log("failed to book this property", error);
    return res.status(500).json({ error: 'Database query error' });
  }
});


// count user bookings 
app.get('/countUserBooking/:userId', async  (req, res) => {
  const { userId } = req.params;
  try {
    const sql = `SELECT COUNT(*) AS bookings FROM bookings WHERE user_id = ?`;
    const results = await query(sql, [userId]);
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.error("Error getting properties count:", error);
  }
})

// get user bookings 
app.get("/userBookings/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      SELECT 
        b.id,
        b.status,
        p.id,
        p.title,
        p.bedrooms,
        p.price,
        p.type,
        p.bathrooms,
        p.address,
        p.description,
        p.city,
        p.image
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.user_id = ?;
    `;

    const results = await query(sql, [id]);
    res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// get user payments 
app.get("/userPayments/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const sql = `
      SELECT 
        m.id,
        m.paid,
        m.status,
        p.id,
        p.title,
        p.bedrooms,
        p.price,
        p.type,
        p.bathrooms,
        p.address,
        p.description,
        p.city,
        p.image
      FROM payment m
      JOIN properties p ON m.property_id = p.id
      WHERE m.user_id = ?;
    `;

    const results = await query(sql, [id]);
    res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching user payments:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// get user payment counts 
app.get('/countUserPayments/:userId', async  (req, res) => {
  const { userId } = req.params;
  try {
    const sql = `SELECT COUNT(*) AS payments FROM payment WHERE user_id = ?`;
    const results = await query(sql, [userId]);
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.error("Error getting payments count:", error);
  }
})

// Update Payment API
app.put("/updatePayment", async (req, res) => {
  const { status, propertyId, amount, accountNo, userId } = req.body;

  if (!propertyId || !accountNo) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  try {
    const sql = "UPDATE payment SET paid = ?, status = ?, account_no = ? WHERE property_id = ? AND user_id = ?";
    await query(sql, [ amount, status, accountNo, propertyId, userId]);
    res.json({ success: true, message: "Payment updated successfully" });
  } catch (error) {
    console.error("Error updating payment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// count bookings
app.get('/countBookings', async  (req, res) => {
  try {
    const sql = `SELECT COUNT(*) AS booked FROM bookings`;
    const results = await query(sql);
    res.json({ Status: "Success", Result: results });
  } catch (error) {
    console.error("Error getting users count:", error);
  }
})

app.get("/getAllBookings", async (req, res) => {
  try {
    const sql =`
   SELECT  
    b.id,
    b.status,
    u.id AS user_id,
    u.name, 
    u.email,
    u.photo, 
    m.id AS payment_id,
    m.status AS payment_status,
    p.id AS property_id,
    p.title,
    p.bedrooms,
    p.price,
    p.type,
    p.bathrooms,
    p.address,
    p.description,
    p.city,
    p.image
FROM bookings b
JOIN users u ON b.user_id = u.id 
JOIN properties p ON b.property_id = p.id
JOIN payment m ON m.property_id = b.property_id; 

`;

    const results = await query(sql);
    res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// get all payments 
app.get("/getAllPayments", async (req, res) => {
  try {
    const sql =`
   SELECT  
    b.id AS booking_id,
    b.status,
    u.id AS user_id,
    u.name, 
    u.email,
    u.photo, 
    m.id AS payment_id,
    m.status AS payment_status,
    m.paid,
    p.id AS property_id,
    p.title,
    p.bedrooms,
    p.price,
    p.type,
    p.bathrooms,
    p.address,
    p.description,
    p.city,
    p.image
FROM payment m
JOIN users u ON m.user_id = u.id 
JOIN properties p ON m.property_id = p.id
JOIN bookings b ON b.property_id = m.property_id; 
`;

    const results = await query(sql);
    res.json({ success: true, Result: results });
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// update booked property status 
app.put("/updateBookingStatus/:id", async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
      const sql = "UPDATE bookings SET status = ? WHERE id = ?";
      await query(sql, [status, id])
      res.json({ Status: "Success", message: "Status updated successfully" });
  } catch (error) {
      res.json({ Status: "Error", Error: "Error updating property status" });
  }
});


// end manage bookings 


// create logout API 
app.get("/logout", (req, res) =>{
  res.clearCookie("token");
  return res.json({Status: "Success"});
})


const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

