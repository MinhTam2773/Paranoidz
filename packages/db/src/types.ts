export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address: string
          city: string
          created_at: string
          district: string | null
          id: string
          is_default: boolean
          label: string | null
          name: string
          phone: string
          user_id: string
          ward: string | null
        }
        Insert: {
          address: string
          city: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          name: string
          phone: string
          user_id: string
          ward?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string | null
          name?: string
          phone?: string
          user_id?: string
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bundle_items: {
        Row: {
          bundle_id: string
          id: string
          product_id: string
        }
        Insert: {
          bundle_id: string
          id?: string
          product_id: string
        }
        Update: {
          bundle_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_items_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          discount_amount: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          qty: number
          user_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          qty: number
          user_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          qty?: number
          user_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          collection_id: string
          id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          collection_id: string
          id?: string
          product_id: string
          sort_order?: number
        }
        Update: {
          collection_id?: string
          id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          created_at: string
          delivered_count: number
          is_blacklisted: boolean
          phone: string
          refusal_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          delivered_count?: number
          is_blacklisted?: boolean
          phone: string
          refusal_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          delivered_count?: number
          is_blacklisted?: boolean
          phone?: string
          refusal_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      flash_sale_windows: {
        Row: {
          created_at: string
          discount_percent: number
          duration_minutes: number
          enabled: boolean
          id: string
          start_hour: number
        }
        Insert: {
          created_at?: string
          discount_percent?: number
          duration_minutes?: number
          enabled?: boolean
          id?: string
          start_hour: number
        }
        Update: {
          created_at?: string
          discount_percent?: number
          duration_minutes?: number
          enabled?: boolean
          id?: string
          start_hour?: number
        }
        Relationships: []
      }
      gacha_codes: {
        Row: {
          code: string
          expires_at: string
          id: string
          issued_at: string
          phone: string | null
          player_key: string | null
          prize_type: string
          redeemed_at: string | null
          redeemed_order_id: string | null
          status: string
          tier: string
        }
        Insert: {
          code: string
          expires_at: string
          id?: string
          issued_at?: string
          phone?: string | null
          player_key?: string | null
          prize_type: string
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          status?: string
          tier: string
        }
        Update: {
          code?: string
          expires_at?: string
          id?: string
          issued_at?: string
          phone?: string | null
          player_key?: string | null
          prize_type?: string
          redeemed_at?: string | null
          redeemed_order_id?: string | null
          status?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_codes_redeemed_order_id_fkey"
            columns: ["redeemed_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_players: {
        Row: {
          created_at: string
          phone: string
          player_key: string | null
        }
        Insert: {
          created_at?: string
          phone: string
          player_key?: string | null
        }
        Update: {
          created_at?: string
          phone?: string
          player_key?: string | null
        }
        Relationships: []
      }
      gacha_spin_grants: {
        Row: {
          amount: number
          created_at: string
          day: string
          id: string
          order_id: string | null
          phone: string | null
          player_key: string | null
          source: string
        }
        Insert: {
          amount?: number
          created_at?: string
          day: string
          id?: string
          order_id?: string | null
          phone?: string | null
          player_key?: string | null
          source: string
        }
        Update: {
          amount?: number
          created_at?: string
          day?: string
          id?: string
          order_id?: string | null
          phone?: string | null
          player_key?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_spin_grants_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      gacha_spins: {
        Row: {
          code_id: string | null
          created_at: string
          funded_by: string
          id: string
          phone: string | null
          player_key: string | null
          prize_type: string
          tier: string
        }
        Insert: {
          code_id?: string | null
          created_at?: string
          funded_by?: string
          id?: string
          phone?: string | null
          player_key?: string | null
          prize_type: string
          tier: string
        }
        Update: {
          code_id?: string | null
          created_at?: string
          funded_by?: string
          id?: string
          phone?: string | null
          player_key?: string | null
          prize_type?: string
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "gacha_spins_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "gacha_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_awards: {
        Row: {
          created_at: string
          gift_id: string | null
          id: string
          milestone: number
          phone: string
          status: Database["public"]["Enums"]["award_status"]
        }
        Insert: {
          created_at?: string
          gift_id?: string | null
          id?: string
          milestone: number
          phone: string
          status?: Database["public"]["Enums"]["award_status"]
        }
        Update: {
          created_at?: string
          gift_id?: string | null
          id?: string
          milestone?: number
          phone?: string
          status?: Database["public"]["Enums"]["award_status"]
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_awards_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "loyalty_gifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_awards_phone_fkey"
            columns: ["phone"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["phone"]
          },
        ]
      }
      loyalty_gifts: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color_snapshot: string | null
          id: string
          image_snapshot: string | null
          is_gift: boolean
          list_price_snapshot: number | null
          name_snapshot: string
          order_id: string
          price_snapshot: number
          product_id: string | null
          qty: number
          size_snapshot: string | null
          sku_snapshot: string | null
          variant_id: string | null
        }
        Insert: {
          color_snapshot?: string | null
          id?: string
          image_snapshot?: string | null
          is_gift?: boolean
          list_price_snapshot?: number | null
          name_snapshot: string
          order_id: string
          price_snapshot: number
          product_id?: string | null
          qty: number
          size_snapshot?: string | null
          sku_snapshot?: string | null
          variant_id?: string | null
        }
        Update: {
          color_snapshot?: string | null
          id?: string
          image_snapshot?: string | null
          is_gift?: boolean
          list_price_snapshot?: number | null
          name_snapshot?: string
          order_id?: string
          price_snapshot?: number
          product_id?: string | null
          qty?: number
          size_snapshot?: string | null
          sku_snapshot?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          created_at: string
          id: string
          note: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          address_id: string | null
          applied_bundles: Json | null
          bigseller_exported_at: string | null
          bigseller_restocked_at: string | null
          city: string
          created_at: string
          delivery_method: string
          discount: number
          district: string | null
          email: string | null
          gacha_code: string | null
          gacha_discount: number
          gacha_gift: string | null
          gift_missing: boolean
          id: string
          note: string | null
          order_number: string
          payment_confirmed_at: string | null
          payment_method: string
          phone: string
          recipient_name: string
          secondary_phone: string | null
          shipping_discount: number
          shipping_fee: number
          spx_created_at: string | null
          spx_fee: number | null
          spx_tracking_no: string | null
          spx_voucher: string | null
          spx_ward: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          user_id: string | null
          ward: string | null
        }
        Insert: {
          address: string
          address_id?: string | null
          applied_bundles?: Json | null
          bigseller_exported_at?: string | null
          bigseller_restocked_at?: string | null
          city: string
          created_at?: string
          delivery_method?: string
          discount?: number
          district?: string | null
          email?: string | null
          gacha_code?: string | null
          gacha_discount?: number
          gacha_gift?: string | null
          gift_missing?: boolean
          id?: string
          note?: string | null
          order_number: string
          payment_confirmed_at?: string | null
          payment_method?: string
          phone: string
          recipient_name: string
          secondary_phone?: string | null
          shipping_discount?: number
          shipping_fee?: number
          spx_created_at?: string | null
          spx_fee?: number | null
          spx_tracking_no?: string | null
          spx_voucher?: string | null
          spx_ward?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          user_id?: string | null
          ward?: string | null
        }
        Update: {
          address?: string
          address_id?: string | null
          applied_bundles?: Json | null
          bigseller_exported_at?: string | null
          bigseller_restocked_at?: string | null
          city?: string
          created_at?: string
          delivery_method?: string
          discount?: number
          district?: string | null
          email?: string | null
          gacha_code?: string | null
          gacha_discount?: number
          gacha_gift?: string | null
          gift_missing?: boolean
          id?: string
          note?: string | null
          order_number?: string
          payment_confirmed_at?: string | null
          payment_method?: string
          phone?: string
          recipient_name?: string
          secondary_phone?: string | null
          shipping_discount?: number
          shipping_fee?: number
          spx_created_at?: string | null
          spx_fee?: number | null
          spx_tracking_no?: string | null
          spx_voucher?: string | null
          spx_ward?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          user_id?: string | null
          ward?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_primary: boolean
          product_id: string
          sort_order: number
          storage_path: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
          storage_path: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string
          color_hex: string | null
          created_at: string
          id: string
          is_order_gift: boolean
          original_price: number | null
          price: number
          product_id: string
          size: string
          sku: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          color: string
          color_hex?: string | null
          created_at?: string
          id?: string
          is_order_gift?: boolean
          original_price?: number | null
          price: number
          product_id: string
          size: string
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          color?: string
          color_hex?: string | null
          created_at?: string
          id?: string
          is_order_gift?: boolean
          original_price?: number | null
          price?: number
          product_id?: string
          size?: string
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          care_instructions: string | null
          category_id: string | null
          created_at: string
          description: string | null
          earns_perks: boolean
          gift_label: string | null
          id: string
          is_active: boolean
          name: string
          shopee_sold_count: number
          size_guide: Json | null
          slug: string
          updated_at: string
          video_poster_url: string | null
          video_url: string | null
        }
        Insert: {
          care_instructions?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          earns_perks?: boolean
          gift_label?: string | null
          id?: string
          is_active?: boolean
          name: string
          shopee_sold_count?: number
          size_guide?: Json | null
          slug: string
          updated_at?: string
          video_poster_url?: string | null
          video_url?: string | null
        }
        Update: {
          care_instructions?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          earns_perks?: boolean
          gift_label?: string | null
          id?: string
          is_active?: boolean
          name?: string
          shopee_sold_count?: number
          size_guide?: Json | null
          slug?: string
          updated_at?: string
          video_poster_url?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          is_admin: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          is_admin?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          is_admin?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          bucket: string
          hits: number
          window_start: string
        }
        Insert: {
          bucket: string
          hits?: number
          window_start: string
        }
        Update: {
          bucket?: string
          hits?: number
          window_start?: string
        }
        Relationships: []
      }
      review_images: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          review_id: string
          sort_order: number
          storage_path: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          review_id: string
          sort_order?: number
          storage_path: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          review_id?: string
          sort_order?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_images_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_images_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_replies: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          is_brand_reply: boolean
          is_visible: boolean
          review_id: string
          user_id: string
        }
        Insert: {
          author_name?: string
          content: string
          created_at?: string
          id?: string
          is_brand_reply?: boolean
          is_visible?: boolean
          review_id: string
          user_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          is_brand_reply?: boolean
          is_visible?: boolean
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_replies_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_replies_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          author_name: string
          content: string
          created_at: string
          id: string
          is_visible: boolean
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          author_name?: string
          content: string
          created_at?: string
          id?: string
          is_visible?: boolean
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          author_name?: string
          content?: string
          created_at?: string
          id?: string
          is_visible?: boolean
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_provinces: {
        Row: {
          city: string
          zone: string
        }
        Insert: {
          city: string
          zone: string
        }
        Update: {
          city?: string
          zone?: string
        }
        Relationships: []
      }
      shipping_rates: {
        Row: {
          fee: number
          max_grams: number
          zone: string
        }
        Insert: {
          fee: number
          max_grams: number
          zone: string
        }
        Update: {
          fee?: number
          max_grams?: number
          zone?: string
        }
        Relationships: []
      }
      spx_locations: {
        Row: {
          province: string
          ward: string
        }
        Insert: {
          province: string
          ward: string
        }
        Update: {
          province?: string
          ward?: string
        }
        Relationships: []
      }
      stock_adjustments: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          exported_at: string | null
          id: string
          reason: string | null
          sku_snapshot: string
          variant_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          exported_at?: string | null
          id?: string
          reason?: string | null
          sku_snapshot: string
          variant_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          exported_at?: string | null
          id?: string
          reason?: string | null
          sku_snapshot?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_uses: {
        Row: {
          created_at: string
          id: string
          order_id: string
          phone: string
          released_at: string | null
          voucher_id: string
          voucher_type: Database["public"]["Enums"]["voucher_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          phone: string
          released_at?: string | null
          voucher_id: string
          voucher_type: Database["public"]["Enums"]["voucher_type"]
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          phone?: string
          released_at?: string | null
          voucher_id?: string
          voucher_type?: Database["public"]["Enums"]["voucher_type"]
        }
        Relationships: [
          {
            foreignKeyName: "voucher_uses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_uses_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          cap_amount: number | null
          code: string
          created_at: string
          discount_pct: number
          expires_at: string | null
          id: string
          is_active: boolean
          is_listed: boolean
          max_uses: number | null
          type: Database["public"]["Enums"]["voucher_type"]
          updated_at: string
          used_count: number
        }
        Insert: {
          cap_amount?: number | null
          code: string
          created_at?: string
          discount_pct: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_listed?: boolean
          max_uses?: number | null
          type?: Database["public"]["Enums"]["voucher_type"]
          updated_at?: string
          used_count?: number
        }
        Update: {
          cap_amount?: number | null
          code?: string
          created_at?: string
          discount_pct?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          is_listed?: boolean
          max_uses?: number | null
          type?: Database["public"]["Enums"]["voucher_type"]
          updated_at?: string
          used_count?: number
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          added_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          added_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          added_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      active_flash_sale_discount: { Args: never; Returns: number }
      adjust_variant_stock: {
        Args: { p_delta: number; p_reason?: string; p_variant_id: string }
        Returns: number
      }
      best_bundles: { Args: { p_counts: Json }; Returns: Json }
      best_bundles_search: {
        Args: { p_bundles: Json; p_counts: Json; p_i: number }
        Returns: Json
      }
      best_seller_ids: {
        Args: { p_limit: number }
        Returns: {
          product_id: string
        }[]
      }
      bigseller_unsent: {
        Args: never
        Returns: {
          unsent_adj: number
          unsent_back: number
          unsent_out: number
          variant_id: string
        }[]
      }
      flash_sale_picks: { Args: { p_at?: string }; Returns: string[] }
      gacha_balance: { Args: { p_player_key: string }; Returns: number }
      gacha_claim_task: {
        Args: { p_player_key: string; p_task: string }
        Returns: Json
      }
      gacha_get_state: { Args: { p_player_key: string }; Returns: Json }
      gacha_quote_code: {
        Args: { p_code: string; p_items: Json }
        Returns: Json
      }
      gacha_spin: { Args: { p_player_key: string }; Returns: Json }
      gacha_today: { Args: never; Returns: string }
      has_delivered_product: {
        Args: { p_product_id: string }
        Returns: boolean
      }
      hit_rate_limit: {
        Args: {
          p_ip: string
          p_ip_limit: number
          p_phone: string
          p_phone_limit: number
          p_scope: string
        }
        Returns: boolean
      }
      immutable_unaccent: { Args: { "": string }; Returns: string }
      mark_bigseller_sent: {
        Args: { p_adjustments: string[]; p_back: string[]; p_out: string[] }
        Returns: Json
      }
      merge_cart: { Args: { p_lines: Json }; Returns: undefined }
      normalize_vn_phone: { Args: { p: string }; Returns: string }
      order_discount: {
        Args: {
          p_counts: Json
          p_items?: Json
          p_phone: string
          p_subtotal: number
          p_voucher_code: string
        }
        Returns: Json
      }
      place_order: {
        Args: {
          p_address?: string
          p_address_id?: string
          p_city?: string
          p_delivery_method?: string
          p_district?: string
          p_email?: string
          p_gacha_code?: string
          p_gacha_player?: string
          p_items: Json
          p_note?: string
          p_phone: string
          p_recipient_name: string
          p_secondary_phone?: string
          p_shipping_fee?: number
          p_spx_voucher?: string
          p_user_id?: string
          p_voucher_code?: string
          p_ward?: string
        }
        Returns: Json
      }
      quote_order: {
        Args: { p_items: Json; p_phone?: string; p_voucher_code?: string }
        Returns: Json
      }
      rename_product_color: {
        Args: { p_from: string; p_product_id: string; p_to: string }
        Returns: undefined
      }
      search_products: {
        Args: { p_query: string }
        Returns: {
          product_id: string
          rank: number
        }[]
      }
      set_variant_stocks: { Args: { p_changes: Json }; Returns: undefined }
      shipping_fee: {
        Args: { p_city: string; p_units: number }
        Returns: number
      }
      short_author_name: { Args: { p_name: string }; Returns: string }
      transition_order_status: {
        Args: {
          p_count_refusal?: boolean
          p_new_status: Database["public"]["Enums"]["order_status"]
          p_note?: string
          p_order_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      award_status: "pending" | "fulfilled"
      order_status:
        | "pending"
        | "confirmed"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "delivery_failed"
      voucher_type: "auto_first5" | "promo" | "standing"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      award_status: ["pending", "fulfilled"],
      order_status: [
        "pending",
        "confirmed",
        "shipped",
        "delivered",
        "cancelled",
        "delivery_failed",
      ],
      voucher_type: ["auto_first5", "promo", "standing"],
    },
  },
} as const

